import type { WaibEvent } from "@waibspace/types";
import type { EventBus } from "@waibspace/event-bus";
import type { MemoryStore } from "./memory-store";

/**
 * A single recorded user behavior observation.
 */
export interface BehaviorObservation {
  /** What the user interacted with (e.g. "email", "calendar", "contact"). */
  domain: string;
  /** The specific action (e.g. "sort", "open", "dismiss", "expand"). */
  action: string;
  /** Optional detail (e.g. sort order "date-desc", contact name). */
  detail?: string;
  /** Unix timestamp when the observation occurred. */
  timestamp: number;
  /** Hour of day (0-23) for temporal pattern detection. */
  hourOfDay: number;
  /** Day of week (0=Sunday, 6=Saturday). */
  dayOfWeek: number;
}

/**
 * Persisted structure stored in memory under the "interaction" category.
 * Aggregates multiple observations for one {domain}:{action} pair.
 */
export interface BehaviorAggregate {
  domain: string;
  action: string;
  /** Total number of times this behavior has been observed. */
  totalCount: number;
  /** Frequency count per detail value (e.g. { "date-desc": 12, "date-asc": 3 }). */
  detailCounts: Record<string, number>;
  /** Histogram of observations per hour of day (24 buckets). */
  hourHistogram: number[];
  /** Histogram of observations per day of week (7 buckets). */
  dayHistogram: number[];
  /** Timestamp of the first observation. */
  firstSeen: number;
  /** Timestamp of the most recent observation. */
  lastSeen: number;
}

export interface BehavioralTrackerOptions {
  /**
   * If true, also listen for planned interactions (wasPlanned !== false).
   * By default only unplanned interactions are tracked.
   */
  trackPlanned?: boolean;
}

const MEMORY_KEY_PREFIX = "behavior:";

/**
 * BehavioralTracker listens for user interaction events on the EventBus,
 * extracts behavioral signals, and persists aggregated observation data
 * to the MemoryStore.
 *
 * This is the "collect" step in the pipeline:
 *   collect observations -> detect patterns -> store preferences -> influence agents
 */
export class BehavioralTracker {
  private readonly trackPlanned: boolean;

  constructor(
    private memoryStore: MemoryStore,
    private eventBus: EventBus,
    options?: BehavioralTrackerOptions,
  ) {
    this.trackPlanned = options?.trackPlanned ?? false;
  }

  /**
   * Begin listening for user interaction events.
   */
  start(): void {
    this.eventBus.on("user.interaction", (event: WaibEvent) => {
      this.handleInteraction(event);
    });
    this.eventBus.on("user.interaction.*", (event: WaibEvent) => {
      this.handleInteraction(event);
    });

    console.log("[behavioral-tracker] Started");
  }

  /**
   * Manually record an observation (useful for non-event-bus sources).
   */
  record(observation: BehaviorObservation): void {
    this.upsertAggregate(observation);
  }

  /**
   * Retrieve all stored behavior aggregates.
   */
  getAllAggregates(): BehaviorAggregate[] {
    const entries = this.memoryStore.getAll("interaction");
    const aggregates: BehaviorAggregate[] = [];
    for (const entry of entries) {
      if (entry.key.startsWith(MEMORY_KEY_PREFIX)) {
        aggregates.push(entry.value as BehaviorAggregate);
      }
    }
    return aggregates;
  }

  /**
   * Retrieve the aggregate for a specific domain:action pair.
   */
  getAggregate(domain: string, action: string): BehaviorAggregate | undefined {
    const key = `${MEMORY_KEY_PREFIX}${domain}:${action}`;
    const entry = this.memoryStore.get("interaction", key);
    return entry ? (entry.value as BehaviorAggregate) : undefined;
  }

  // ---- Private ----

  private handleInteraction(event: WaibEvent): void {
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload) return;

    // By default, skip planned interactions (they don't reflect user preference)
    if (!this.trackPlanned && payload.wasPlanned !== false) return;

    const observation = this.extractObservation(payload);
    if (!observation) return;

    this.upsertAggregate(observation);
  }

  private extractObservation(
    payload: Record<string, unknown>,
  ): BehaviorObservation | null {
    // Accept domain from multiple possible payload shapes
    const domain =
      (payload.domain as string) ??
      (payload.blockType as string) ??
      (payload.surfaceType as string);
    const action =
      (payload.action as string) ??
      (payload.interactionType as string) ??
      (payload.interaction as string);

    if (!domain || !action) return null;

    const now = new Date();
    return {
      domain,
      action,
      detail: payload.detail as string | undefined,
      timestamp: Date.now(),
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
    };
  }

  private upsertAggregate(obs: BehaviorObservation): void {
    const key = `${MEMORY_KEY_PREFIX}${obs.domain}:${obs.action}`;
    const existing = this.memoryStore.get("interaction", key);

    let agg: BehaviorAggregate;
    if (existing) {
      agg = existing.value as BehaviorAggregate;
      agg.totalCount += 1;
      agg.lastSeen = obs.timestamp;
      agg.hourHistogram[obs.hourOfDay] += 1;
      agg.dayHistogram[obs.dayOfWeek] += 1;
      if (obs.detail) {
        agg.detailCounts[obs.detail] = (agg.detailCounts[obs.detail] ?? 0) + 1;
      }
    } else {
      agg = {
        domain: obs.domain,
        action: obs.action,
        totalCount: 1,
        detailCounts: obs.detail ? { [obs.detail]: 1 } : {},
        hourHistogram: new Array(24).fill(0),
        dayHistogram: new Array(7).fill(0),
        firstSeen: obs.timestamp,
        lastSeen: obs.timestamp,
      };
      agg.hourHistogram[obs.hourOfDay] = 1;
      agg.dayHistogram[obs.dayOfWeek] = 1;
    }

    this.memoryStore.set("interaction", key, agg, "behavioral-tracker");
  }
}
