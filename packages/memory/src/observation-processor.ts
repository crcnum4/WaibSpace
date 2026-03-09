import type { WaibEvent } from "@waibspace/types";
import type { EventBus } from "@waibspace/event-bus";
import { createEvent } from "@waibspace/event-bus";
import type { MemoryStore } from "./memory-store";

/** Default number of unplanned occurrences before a pattern is detected. */
const DEFAULT_THRESHOLD = 3;

/** In-memory counter for unplanned interaction patterns. */
interface PatternCounter {
  blockType: string;
  interactionType: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface ObservationProcessorOptions {
  /** How many unplanned observations of the same kind trigger a pattern event. */
  threshold?: number;
}

/**
 * Observes `user.interaction` events on the EventBus and detects recurring
 * patterns among *unplanned* interactions (wasPlanned === false).
 *
 * When a {blockType}:{interactionType} pair reaches the configured threshold,
 * the processor:
 *   1. Emits an `observation.pattern.detected` event on the bus.
 *   2. Persists the learned pattern in the MemoryStore so future agents can
 *      read it via the standard memory retrieval path.
 */
export class ObservationProcessor {
  private counters = new Map<string, PatternCounter>();
  private emittedPatterns = new Set<string>();
  private readonly threshold: number;

  constructor(
    private memoryStore: MemoryStore,
    private eventBus: EventBus,
    options?: ObservationProcessorOptions,
  ) {
    this.threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  }

  /**
   * Begin listening for `user.interaction` events.
   * Call this once during application startup.
   */
  start(): void {
    this.eventBus.on("user.interaction", (event: WaibEvent) => {
      this.processObservation(event);
    });

    // Also match namespaced interaction events (e.g. user.interaction.click)
    this.eventBus.on("user.interaction.*", (event: WaibEvent) => {
      this.processObservation(event);
    });

    console.log(
      `[observation-processor] Started (threshold=${this.threshold})`,
    );
  }

  /** Return all counters — useful for diagnostics / tests. */
  getCounters(): ReadonlyMap<string, Readonly<PatternCounter>> {
    return this.counters;
  }

  // ---- Private ----

  private processObservation(event: WaibEvent): void {
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload) return;

    // Only track unplanned interactions
    if (payload.wasPlanned !== false) return;

    const blockType = payload.blockType as string | undefined;
    const interactionType = payload.interactionType as string | undefined;

    if (!blockType || !interactionType) return;

    const key = `${blockType}:${interactionType}`;
    const now = Date.now();

    // Upsert counter
    const existing = this.counters.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
    } else {
      this.counters.set(key, {
        blockType,
        interactionType,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
    }

    const counter = this.counters.get(key)!;

    // Check threshold — only emit once per pattern key
    if (counter.count >= this.threshold && !this.emittedPatterns.has(key)) {
      this.emittedPatterns.add(key);
      this.emitPattern(counter, event.traceId);
      this.persistPattern(counter);
    }
  }

  private emitPattern(counter: PatternCounter, traceId: string): void {
    const patternPayload = {
      blockType: counter.blockType,
      interactionType: counter.interactionType,
      count: counter.count,
      firstSeen: counter.firstSeen,
      lastSeen: counter.lastSeen,
    };

    this.eventBus.emit(
      createEvent(
        "observation.pattern.detected",
        patternPayload,
        "observation-processor",
        traceId,
      ),
    );

    console.log(
      `[observation-processor] Pattern detected: ${counter.blockType}:${counter.interactionType} (count=${counter.count})`,
    );
  }

  private persistPattern(counter: PatternCounter): void {
    const memoryKey = `learned-pattern:${counter.blockType}:${counter.interactionType}`;
    this.memoryStore.set(
      "interaction",
      memoryKey,
      {
        blockType: counter.blockType,
        interactionType: counter.interactionType,
        count: counter.count,
        firstSeen: counter.firstSeen,
        lastSeen: counter.lastSeen,
      },
      "observation-processor",
    );
  }
}
