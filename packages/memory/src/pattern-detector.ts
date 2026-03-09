import type { WaibEvent } from "@waibspace/types";
import type { EventBus } from "@waibspace/event-bus";
import { createEvent } from "@waibspace/event-bus";
import type { MemoryStore } from "./memory-store";

// ---- Public types ----

/** Time-of-day bucket used for scheduling pattern detection. */
export type TimeOfDayBucket = "morning" | "afternoon" | "evening" | "night";

/** A single recorded user action. */
export interface ActionRecord {
  actionType: string;
  /** Target of the action, e.g. "newsletters", "Friday meetings". */
  target: string;
  timestamp: number;
  timeOfDay: TimeOfDayBucket;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
}

/** A detected recurring pattern ready to be surfaced as a suggestion. */
export interface DetectedPattern {
  /** Unique key for deduplication, e.g. "archive:newsletters:morning". */
  key: string;
  actionType: string;
  target: string;
  /** Dominant time-of-day when the action occurs. */
  timeOfDay: TimeOfDayBucket;
  /** Days of the week the action most commonly occurs (may be empty). */
  dominantDays: number[];
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  /** Human-readable suggestion, e.g. "Auto-archive newsletters every morning?" */
  suggestion: string;
}

export interface PatternDetectorOptions {
  /** Minimum occurrences before a pattern is detected. Default: 3 */
  threshold?: number;
  /** Minimum ratio for a time-of-day bucket to be considered dominant. Default: 0.5 */
  timeDominanceRatio?: number;
  /** Minimum ratio for a day-of-week to be considered dominant. Default: 0.4 */
  dayDominanceRatio?: number;
}

// ---- Internals ----

interface ActionBucket {
  actionType: string;
  target: string;
  records: ActionRecord[];
}

const DEFAULT_THRESHOLD = 3;
const DEFAULT_TIME_DOMINANCE_RATIO = 0.5;
const DEFAULT_DAY_DOMINANCE_RATIO = 0.4;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---- Helper functions ----

/** Map an hour (0-23) to a time-of-day bucket. */
export function hourToBucket(hour: number): TimeOfDayBucket {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Build a human-readable suggestion string from a detected pattern. */
function buildSuggestion(pattern: Omit<DetectedPattern, "suggestion">): string {
  const verb = pattern.actionType;
  const target = pattern.target;
  const time = pattern.timeOfDay;

  const dayPart =
    pattern.dominantDays.length > 0 && pattern.dominantDays.length <= 3
      ? ` on ${pattern.dominantDays.map((d) => DAY_NAMES[d]).join(", ")}`
      : "";

  return `Auto-${verb} ${target} every ${time}${dayPart}?`;
}

/**
 * Find the dominant value in a frequency map if it exceeds the given ratio.
 * Returns undefined if no single value dominates.
 */
function findDominant<T extends string | number>(
  counts: Map<T, number>,
  total: number,
  ratio: number,
): T | undefined {
  for (const [value, count] of counts) {
    if (count / total >= ratio) return value;
  }
  return undefined;
}

// ---- PatternDetector class ----

/**
 * Heuristic-based detector that watches user action events and identifies
 * recurring patterns.  When a pattern crosses the threshold it:
 *
 *   1. Emits an `automation.suggestion` event on the EventBus so the UI
 *      layer can surface it.
 *   2. Persists the pattern in MemoryStore under the `task` category so
 *      agents can read it later.
 *
 * No LLM calls — purely frequency / time-of-day / day-of-week heuristics.
 */
export class PatternDetector {
  private buckets = new Map<string, ActionBucket>();
  private emittedKeys = new Set<string>();

  private readonly threshold: number;
  private readonly timeDominanceRatio: number;
  private readonly dayDominanceRatio: number;

  constructor(
    private memoryStore: MemoryStore,
    private eventBus: EventBus,
    options?: PatternDetectorOptions,
  ) {
    this.threshold = options?.threshold ?? DEFAULT_THRESHOLD;
    this.timeDominanceRatio = options?.timeDominanceRatio ?? DEFAULT_TIME_DOMINANCE_RATIO;
    this.dayDominanceRatio = options?.dayDominanceRatio ?? DEFAULT_DAY_DOMINANCE_RATIO;

    // Hydrate previously-emitted keys from memory so we don't re-suggest
    const existing = this.memoryStore.getAll("task");
    for (const entry of existing) {
      if (entry.key.startsWith("automation-pattern:")) {
        const patternKey = entry.key.replace("automation-pattern:", "");
        this.emittedKeys.add(patternKey);
      }
    }
  }

  /**
   * Start listening for `user.action` events on the bus.
   * Events should carry payload: { actionType, target, timestamp? }
   *
   * Also listens for `user.interaction` events and normalises them into
   * the same format (actionType = interactionType, target = blockType).
   */
  start(): void {
    this.eventBus.on("user.action", (event: WaibEvent) => {
      const payload = event.payload as Record<string, unknown> | null;
      if (!payload) return;

      const actionType = payload.actionType as string | undefined;
      const target = payload.target as string | undefined;
      if (!actionType || !target) return;

      const timestamp = (payload.timestamp as number | undefined) ?? event.timestamp;
      this.recordAction(actionType, target, timestamp);
    });

    // Bridge existing user.interaction events
    this.eventBus.on("user.interaction", (event: WaibEvent) => {
      this.handleInteractionEvent(event);
    });
    this.eventBus.on("user.interaction.*", (event: WaibEvent) => {
      this.handleInteractionEvent(event);
    });

    console.log(
      `[pattern-detector] Started (threshold=${this.threshold})`,
    );
  }

  /**
   * Manually record an action (useful for testing or direct integration).
   * Returns a DetectedPattern if the threshold was crossed, otherwise undefined.
   */
  recordAction(
    actionType: string,
    target: string,
    timestamp: number = Date.now(),
  ): DetectedPattern | undefined {
    const bucketKey = `${actionType}:${target}`;
    const date = new Date(timestamp);
    const record: ActionRecord = {
      actionType,
      target,
      timestamp,
      timeOfDay: hourToBucket(date.getHours()),
      dayOfWeek: date.getDay(),
    };

    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = { actionType, target, records: [] };
      this.buckets.set(bucketKey, bucket);
    }
    bucket.records.push(record);

    if (bucket.records.length >= this.threshold) {
      return this.analyzeAndEmit(bucket);
    }
    return undefined;
  }

  /** Return all currently tracked buckets (diagnostic). */
  getBuckets(): ReadonlyMap<string, Readonly<ActionBucket>> {
    return this.buckets;
  }

  /** Return the set of pattern keys already emitted. */
  getEmittedKeys(): ReadonlySet<string> {
    return this.emittedKeys;
  }

  // ---- Private ----

  private handleInteractionEvent(event: WaibEvent): void {
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload) return;

    const actionType = (payload.interactionType ?? payload.interaction) as string | undefined;
    const target = (payload.blockType ?? payload.surfaceType) as string | undefined;
    if (!actionType || !target) return;

    const timestamp = (payload.timestamp as number | undefined) ?? event.timestamp;
    this.recordAction(actionType, target, timestamp);
  }

  /**
   * Analyze a bucket to determine whether a pattern exists and, if so,
   * emit + persist it (once per unique pattern key).
   */
  private analyzeAndEmit(bucket: ActionBucket): DetectedPattern | undefined {
    const records = bucket.records;
    const total = records.length;

    // Count time-of-day distribution
    const timeCounts = new Map<TimeOfDayBucket, number>();
    for (const r of records) {
      timeCounts.set(r.timeOfDay, (timeCounts.get(r.timeOfDay) ?? 0) + 1);
    }

    const dominantTime = findDominant(timeCounts, total, this.timeDominanceRatio);
    if (!dominantTime) return undefined; // No clear time pattern

    // Count day-of-week distribution
    const dayCounts = new Map<number, number>();
    for (const r of records) {
      dayCounts.set(r.dayOfWeek, (dayCounts.get(r.dayOfWeek) ?? 0) + 1);
    }

    const dominantDays: number[] = [];
    for (const [day, count] of dayCounts) {
      if (count / total >= this.dayDominanceRatio) {
        dominantDays.push(day);
      }
    }
    dominantDays.sort((a, b) => a - b);

    const patternKey =
      dominantDays.length > 0
        ? `${bucket.actionType}:${bucket.target}:${dominantTime}:${dominantDays.join(",")}`
        : `${bucket.actionType}:${bucket.target}:${dominantTime}`;

    // Already emitted?
    if (this.emittedKeys.has(patternKey)) return undefined;

    const partial: Omit<DetectedPattern, "suggestion"> = {
      key: patternKey,
      actionType: bucket.actionType,
      target: bucket.target,
      timeOfDay: dominantTime,
      dominantDays,
      occurrences: total,
      firstSeen: records[0].timestamp,
      lastSeen: records[records.length - 1].timestamp,
    };

    const pattern: DetectedPattern = {
      ...partial,
      suggestion: buildSuggestion(partial),
    };

    this.emittedKeys.add(patternKey);
    this.emitSuggestion(pattern);
    this.persistPattern(pattern);

    return pattern;
  }

  private emitSuggestion(pattern: DetectedPattern): void {
    this.eventBus.emit(
      createEvent(
        "automation.suggestion",
        {
          patternKey: pattern.key,
          actionType: pattern.actionType,
          target: pattern.target,
          timeOfDay: pattern.timeOfDay,
          dominantDays: pattern.dominantDays,
          occurrences: pattern.occurrences,
          suggestion: pattern.suggestion,
        },
        "pattern-detector",
      ),
    );

    console.log(
      `[pattern-detector] Suggestion: ${pattern.suggestion} (occurrences=${pattern.occurrences})`,
    );
  }

  private persistPattern(pattern: DetectedPattern): void {
    this.memoryStore.set(
      "task",
      `automation-pattern:${pattern.key}`,
      {
        actionType: pattern.actionType,
        target: pattern.target,
        timeOfDay: pattern.timeOfDay,
        dominantDays: pattern.dominantDays,
        occurrences: pattern.occurrences,
        firstSeen: pattern.firstSeen,
        lastSeen: pattern.lastSeen,
        suggestion: pattern.suggestion,
      },
      "pattern-detector",
    );
  }
}
