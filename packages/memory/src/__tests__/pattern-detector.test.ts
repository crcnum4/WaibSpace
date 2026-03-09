import { describe, it, expect, beforeEach } from "bun:test";
import { PatternDetector, hourToBucket } from "../pattern-detector";
import type { DetectedPattern } from "../pattern-detector";
import { MemoryStore } from "../memory-store";
import { EventBus } from "@waibspace/event-bus";
import { createEvent } from "@waibspace/event-bus";
import type { WaibEvent } from "@waibspace/types";

/**
 * Create a timestamp for a specific hour on a specific day-of-week.
 * Uses a known reference Monday (2026-03-09 is a Monday).
 */
function makeTimestamp(hour: number, dayOffset = 0): number {
  // 2026-03-09 00:00 UTC is a Monday (dayOfWeek = 1)
  const base = new Date("2026-03-09T00:00:00Z");
  base.setDate(base.getDate() + dayOffset);
  base.setHours(hour, 0, 0, 0);
  return base.getTime();
}

describe("hourToBucket", () => {
  it("maps early morning to morning", () => {
    expect(hourToBucket(5)).toBe("morning");
    expect(hourToBucket(11)).toBe("morning");
  });

  it("maps midday to afternoon", () => {
    expect(hourToBucket(12)).toBe("afternoon");
    expect(hourToBucket(16)).toBe("afternoon");
  });

  it("maps late day to evening", () => {
    expect(hourToBucket(17)).toBe("evening");
    expect(hourToBucket(20)).toBe("evening");
  });

  it("maps late night to night", () => {
    expect(hourToBucket(21)).toBe("night");
    expect(hourToBucket(4)).toBe("night");
    expect(hourToBucket(0)).toBe("night");
  });
});

describe("PatternDetector", () => {
  let memoryStore: MemoryStore;
  let eventBus: EventBus;
  let detector: PatternDetector;

  beforeEach(() => {
    memoryStore = new MemoryStore();
    eventBus = new EventBus();
    detector = new PatternDetector(memoryStore, eventBus, { threshold: 3 });
  });

  describe("recordAction", () => {
    it("does not detect a pattern below threshold", () => {
      const result1 = detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      const result2 = detector.recordAction("archive", "newsletters", makeTimestamp(8, 1));

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it("detects a pattern at threshold with consistent time-of-day", () => {
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      detector.recordAction("archive", "newsletters", makeTimestamp(9, 1));
      const result = detector.recordAction("archive", "newsletters", makeTimestamp(7, 2));

      expect(result).toBeDefined();
      expect(result!.actionType).toBe("archive");
      expect(result!.target).toBe("newsletters");
      expect(result!.timeOfDay).toBe("morning");
      expect(result!.occurrences).toBe(3);
      expect(result!.suggestion).toContain("Auto-archive newsletters every morning");
    });

    it("does not detect a pattern when time-of-day is inconsistent", () => {
      // Spread across all time buckets — no dominance
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));   // morning
      detector.recordAction("archive", "newsletters", makeTimestamp(14, 1));  // afternoon
      const result = detector.recordAction("archive", "newsletters", makeTimestamp(22, 2)); // night

      expect(result).toBeUndefined();
    });

    it("does not emit the same pattern twice", () => {
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      detector.recordAction("archive", "newsletters", makeTimestamp(9, 1));
      const first = detector.recordAction("archive", "newsletters", makeTimestamp(7, 2));

      // 4th occurrence — should not re-emit
      const second = detector.recordAction("archive", "newsletters", makeTimestamp(8, 3));

      expect(first).toBeDefined();
      expect(second).toBeUndefined();
    });

    it("includes dominant days in the suggestion", () => {
      // All on Mondays (dayOffset 0 from our reference Monday)
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      detector.recordAction("archive", "newsletters", makeTimestamp(9, 7));  // next Monday
      const result = detector.recordAction("archive", "newsletters", makeTimestamp(7, 14)); // next-next Monday

      expect(result).toBeDefined();
      expect(result!.dominantDays).toContain(1); // Monday
      expect(result!.suggestion).toContain("Monday");
    });
  });

  describe("persistence", () => {
    it("persists detected patterns to MemoryStore under 'task' category", () => {
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      detector.recordAction("archive", "newsletters", makeTimestamp(9, 1));
      detector.recordAction("archive", "newsletters", makeTimestamp(7, 2));

      const taskEntries = memoryStore.getAll("task");
      const patternEntries = taskEntries.filter((e) =>
        e.key.startsWith("automation-pattern:"),
      );

      expect(patternEntries).toHaveLength(1);
      const value = patternEntries[0].value as Record<string, unknown>;
      expect(value.actionType).toBe("archive");
      expect(value.target).toBe("newsletters");
      expect(value.suggestion).toContain("Auto-archive");
    });

    it("hydrates emitted keys from memory on construction", () => {
      // First detector detects and persists
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      detector.recordAction("archive", "newsletters", makeTimestamp(9, 1));
      detector.recordAction("archive", "newsletters", makeTimestamp(7, 2));

      // Second detector should pick up the persisted keys
      const detector2 = new PatternDetector(memoryStore, eventBus, { threshold: 3 });
      expect(detector2.getEmittedKeys().size).toBeGreaterThan(0);
    });
  });

  describe("EventBus integration", () => {
    it("emits automation.suggestion event when pattern detected", () => {
      const suggestions: WaibEvent[] = [];
      eventBus.on("automation.suggestion", (event) => {
        suggestions.push(event);
      });

      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      detector.recordAction("archive", "newsletters", makeTimestamp(9, 1));
      detector.recordAction("archive", "newsletters", makeTimestamp(7, 2));

      expect(suggestions).toHaveLength(1);
      const payload = suggestions[0].payload as Record<string, unknown>;
      expect(payload.actionType).toBe("archive");
      expect(payload.suggestion).toContain("Auto-archive");
    });

    it("picks up user.action events when started", () => {
      detector.start();

      const suggestions: WaibEvent[] = [];
      eventBus.on("automation.suggestion", (event) => {
        suggestions.push(event);
      });

      for (let i = 0; i < 3; i++) {
        eventBus.emit(
          createEvent(
            "user.action",
            {
              actionType: "reschedule",
              target: "Friday meetings",
              timestamp: makeTimestamp(9, i),
            },
            "test",
          ),
        );
      }

      expect(suggestions).toHaveLength(1);
      const payload = suggestions[0].payload as Record<string, unknown>;
      expect(payload.actionType).toBe("reschedule");
      expect(payload.target).toBe("Friday meetings");
    });

    it("bridges user.interaction events to action tracking", () => {
      detector.start();

      const suggestions: WaibEvent[] = [];
      eventBus.on("automation.suggestion", (event) => {
        suggestions.push(event);
      });

      for (let i = 0; i < 3; i++) {
        eventBus.emit(
          createEvent(
            "user.interaction",
            {
              interactionType: "dismiss",
              blockType: "notification-card",
              wasPlanned: false,
              timestamp: makeTimestamp(19, i), // evening
            },
            "test",
          ),
        );
      }

      expect(suggestions).toHaveLength(1);
      const payload = suggestions[0].payload as Record<string, unknown>;
      expect(payload.actionType).toBe("dismiss");
      expect(payload.target).toBe("notification-card");
      expect(payload.timeOfDay).toBe("evening");
    });
  });

  describe("diagnostic methods", () => {
    it("exposes buckets for diagnostics", () => {
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      const buckets = detector.getBuckets();
      expect(buckets.size).toBe(1);
      expect(buckets.has("archive:newsletters")).toBe(true);
    });

    it("tracks emitted keys", () => {
      expect(detector.getEmittedKeys().size).toBe(0);
      detector.recordAction("archive", "newsletters", makeTimestamp(8, 0));
      detector.recordAction("archive", "newsletters", makeTimestamp(9, 1));
      detector.recordAction("archive", "newsletters", makeTimestamp(7, 2));
      expect(detector.getEmittedKeys().size).toBe(1);
    });
  });
});
