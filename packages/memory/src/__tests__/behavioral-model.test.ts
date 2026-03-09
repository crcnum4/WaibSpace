import { describe, it, expect, beforeEach } from "bun:test";
import { MemoryStore } from "../memory-store";
import { BehavioralTracker } from "../behavioral-tracker";
import { BehavioralModel } from "../behavioral-model";
import type { LearnedPreference } from "../behavioral-model";
import { EventBus } from "@waibspace/event-bus";

describe("BehavioralModel", () => {
  let memoryStore: MemoryStore;
  let eventBus: EventBus;
  let tracker: BehavioralTracker;
  let model: BehavioralModel;

  beforeEach(() => {
    eventBus = new EventBus();
    memoryStore = new MemoryStore();
    tracker = new BehavioralTracker(memoryStore, eventBus);
    model = new BehavioralModel(memoryStore, { minObservations: 3 });
  });

  function recordObservations(
    domain: string,
    action: string,
    count: number,
    detail?: string,
    hourOfDay = 10,
    dayOfWeek = 1,
  ): void {
    // Spread timestamps over multiple days for frequency calculation
    const baseTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
    for (let i = 0; i < count; i++) {
      tracker.record({
        domain,
        action,
        detail,
        timestamp: baseTime + i * 24 * 60 * 60 * 1000, // 1 day apart
        hourOfDay,
        dayOfWeek,
      });
    }
  }

  it("returns no preferences when there are no observations", () => {
    const prefs = model.computePreferences();
    expect(prefs).toEqual([]);
  });

  it("returns no preferences below the minimum observation threshold", () => {
    recordObservations("email", "sort", 2, "date-desc");
    const prefs = model.computePreferences();
    // Should not produce a detail preference with only 2 observations
    const detailPref = prefs.find((p) => p.preferenceKey === "sort-preference");
    expect(detailPref).toBeUndefined();
  });

  it("derives a detail preference when one option dominates", () => {
    recordObservations("email", "sort", 8, "date-desc");
    recordObservations("email", "sort", 2, "date-asc");

    const prefs = model.computePreferences();
    const sortPref = prefs.find((p) => p.preferenceKey === "sort-preference");
    expect(sortPref).toBeDefined();
    expect(sortPref!.domain).toBe("email");
    expect(sortPref!.value).toBe("date-desc");
    expect(sortPref!.confidence).toBeGreaterThan(0.5);
  });

  it("does NOT derive a detail preference when choices are evenly split", () => {
    recordObservations("email", "sort", 5, "date-desc");
    recordObservations("email", "sort", 5, "date-asc");

    const prefs = model.computePreferences();
    const sortPref = prefs.find((p) => p.preferenceKey === "sort-preference");
    // 5/5 = 1.0 ratio, below default dominance threshold of 1.5
    expect(sortPref).toBeUndefined();
  });

  it("derives peak hour preference from concentrated usage", () => {
    // All observations at hour 9
    recordObservations("email", "check", 6, undefined, 9);

    const prefs = model.computePreferences();
    const peakHour = prefs.find(
      (p) => p.preferenceKey === "check-peak-hour",
    );
    expect(peakHour).toBeDefined();
    expect(peakHour!.value).toBe(9);
    expect(peakHour!.confidence).toBeGreaterThan(0);
  });

  it("derives peak day preference from concentrated usage", () => {
    // All observations on Tuesday (dayOfWeek=2)
    recordObservations("calendar", "review", 5, undefined, 10, 2);

    const prefs = model.computePreferences();
    const peakDay = prefs.find(
      (p) => p.preferenceKey === "review-peak-day",
    );
    expect(peakDay).toBeDefined();
    expect(peakDay!.value).toBe("tuesday");
  });

  it("derives daily frequency for actions spanning multiple days", () => {
    recordObservations("email", "check", 7);

    const prefs = model.computePreferences();
    const freq = prefs.find(
      (p) => p.preferenceKey === "check-daily-frequency",
    );
    expect(freq).toBeDefined();
    expect(typeof freq!.value).toBe("number");
    expect(freq!.value as number).toBeGreaterThan(0);
  });

  it("derives domain affinity (most-used-domain)", () => {
    recordObservations("email", "check", 10);
    recordObservations("calendar", "view", 3);

    const prefs = model.computePreferences();
    const domainPref = prefs.find(
      (p) => p.preferenceKey === "most-used-domain",
    );
    expect(domainPref).toBeDefined();
    expect(domainPref!.value).toBe("email");
  });

  it("persistPreferences writes to profile memory", () => {
    recordObservations("email", "sort", 10, "date-desc");

    const persisted = model.persistPreferences();
    expect(persisted.length).toBeGreaterThan(0);

    // Check that preferences are readable from the memory store
    const profileEntries = memoryStore.getAll("profile");
    const learnedEntries = profileEntries.filter((e) =>
      e.key.startsWith("learned:"),
    );
    expect(learnedEntries.length).toBeGreaterThan(0);
  });

  it("allows configuring the dominance ratio", () => {
    const strictModel = new BehavioralModel(memoryStore, {
      minObservations: 3,
      dominanceRatio: 3.0,
    });

    recordObservations("email", "sort", 6, "date-desc");
    recordObservations("email", "sort", 3, "date-asc");

    // With ratio 3.0, 6/3 = 2.0 is not enough
    const prefs = strictModel.computePreferences();
    const sortPref = prefs.find((p) => p.preferenceKey === "sort-preference");
    expect(sortPref).toBeUndefined();
  });
});
