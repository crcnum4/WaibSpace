import { describe, it, expect, beforeEach } from "bun:test";
import { EngagementTracker } from "../engagement-tracker";
import { MemoryStore } from "../memory-store";

describe("EngagementTracker", () => {
  let memoryStore: MemoryStore;
  let tracker: EngagementTracker;

  beforeEach(() => {
    memoryStore = new MemoryStore();
    tracker = new EngagementTracker(memoryStore);
  });

  describe("recordInteraction", () => {
    it("should store a new interaction in memory", () => {
      tracker.recordInteraction({
        surfaceType: "inbox",
        surfaceId: "inbox-1",
        interaction: "click",
        timestamp: Date.now(),
      });

      const entry = memoryStore.get("engagement", "surface:inbox");
      expect(entry).toBeDefined();
      expect((entry!.value as { totalInteractions: number }).totalInteractions).toBe(1);
    });

    it("should increment counts for repeated interactions", () => {
      const now = Date.now();
      tracker.recordInteraction({
        surfaceType: "calendar",
        surfaceId: "cal-1",
        interaction: "click",
        timestamp: now,
      });
      tracker.recordInteraction({
        surfaceType: "calendar",
        surfaceId: "cal-1",
        interaction: "expand",
        timestamp: now + 1000,
      });
      tracker.recordInteraction({
        surfaceType: "calendar",
        surfaceId: "cal-1",
        interaction: "click",
        timestamp: now + 2000,
      });

      const entry = memoryStore.get("engagement", "surface:calendar");
      const metrics = entry!.value as {
        totalInteractions: number;
        interactionsByType: Record<string, number>;
      };
      expect(metrics.totalInteractions).toBe(3);
      expect(metrics.interactionsByType["click"]).toBe(2);
      expect(metrics.interactionsByType["expand"]).toBe(1);
    });
  });

  describe("getScores", () => {
    it("should return empty array with no data", () => {
      expect(tracker.getScores()).toEqual([]);
    });

    it("should rank more-interacted surfaces higher", () => {
      const now = Date.now();

      // Inbox: 5 interactions
      for (let i = 0; i < 5; i++) {
        tracker.recordInteraction({
          surfaceType: "inbox",
          surfaceId: "inbox-1",
          interaction: "click",
          timestamp: now + i,
        });
      }

      // Calendar: 1 interaction
      tracker.recordInteraction({
        surfaceType: "calendar",
        surfaceId: "cal-1",
        interaction: "click",
        timestamp: now,
      });

      const scores = tracker.getScores();
      expect(scores.length).toBe(2);
      expect(scores[0].surfaceType).toBe("inbox");
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
    });

    it("should produce scores between 0 and 1", () => {
      const now = Date.now();
      tracker.recordInteraction({
        surfaceType: "inbox",
        surfaceId: "inbox-1",
        interaction: "click",
        timestamp: now,
      });

      const scores = tracker.getScores();
      for (const s of scores) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("getProminenceMap", () => {
    it("should return empty map with no data", () => {
      expect(tracker.getProminenceMap().size).toBe(0);
    });

    it("should assign hero to top surface and compact to lowest", () => {
      const now = Date.now();

      // High engagement
      for (let i = 0; i < 10; i++) {
        tracker.recordInteraction({
          surfaceType: "inbox",
          surfaceId: "inbox-1",
          interaction: "click",
          timestamp: now + i,
        });
      }

      // Medium engagement
      for (let i = 0; i < 5; i++) {
        tracker.recordInteraction({
          surfaceType: "calendar",
          surfaceId: "cal-1",
          interaction: "click",
          timestamp: now + i,
        });
      }

      // Low engagement
      tracker.recordInteraction({
        surfaceType: "discovery",
        surfaceId: "disc-1",
        interaction: "click",
        timestamp: now,
      });

      const map = tracker.getProminenceMap();
      expect(map.get("inbox")).toBe("hero");
      expect(map.get("discovery")).toBe("compact");
    });
  });

  describe("getScoreFor", () => {
    it("should return undefined for unknown surface types", () => {
      expect(tracker.getScoreFor("nonexistent")).toBeUndefined();
    });

    it("should return score for tracked surface type", () => {
      tracker.recordInteraction({
        surfaceType: "inbox",
        surfaceId: "inbox-1",
        interaction: "click",
        timestamp: Date.now(),
      });

      const score = tracker.getScoreFor("inbox");
      expect(score).toBeDefined();
      expect(score!.surfaceType).toBe("inbox");
      expect(score!.score).toBeGreaterThan(0);
    });
  });
});
