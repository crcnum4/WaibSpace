import { describe, it, expect, beforeEach } from "bun:test";
import { MemoryStore } from "../memory-store";
import { BehavioralTracker } from "../behavioral-tracker";
import type { BehaviorAggregate } from "../behavioral-tracker";
import { EventBus, createEvent } from "@waibspace/event-bus";

describe("BehavioralTracker", () => {
  let memoryStore: MemoryStore;
  let eventBus: EventBus;
  let tracker: BehavioralTracker;

  beforeEach(() => {
    eventBus = new EventBus();
    memoryStore = new MemoryStore(undefined, eventBus);
    tracker = new BehavioralTracker(memoryStore, eventBus);
    tracker.start();
  });

  it("records an unplanned interaction as a behavior aggregate", () => {
    const event = createEvent("user.interaction", {
      wasPlanned: false,
      domain: "email",
      action: "sort",
      detail: "date-desc",
    }, "test");

    eventBus.emit(event);

    const agg = tracker.getAggregate("email", "sort");
    expect(agg).toBeDefined();
    expect(agg!.totalCount).toBe(1);
    expect(agg!.detailCounts["date-desc"]).toBe(1);
    expect(agg!.domain).toBe("email");
    expect(agg!.action).toBe("sort");
  });

  it("ignores planned interactions by default", () => {
    const event = createEvent("user.interaction", {
      wasPlanned: true,
      domain: "email",
      action: "sort",
    }, "test");

    eventBus.emit(event);

    const agg = tracker.getAggregate("email", "sort");
    expect(agg).toBeUndefined();
  });

  it("tracks planned interactions when configured", () => {
    const trackerWithPlanned = new BehavioralTracker(memoryStore, eventBus, {
      trackPlanned: true,
    });
    trackerWithPlanned.start();

    const event = createEvent("user.interaction", {
      wasPlanned: true,
      domain: "email",
      action: "sort",
    }, "test");

    eventBus.emit(event);

    const agg = trackerWithPlanned.getAggregate("email", "sort");
    expect(agg).toBeDefined();
  });

  it("accumulates counts across multiple interactions", () => {
    for (let i = 0; i < 5; i++) {
      eventBus.emit(
        createEvent("user.interaction", {
          wasPlanned: false,
          domain: "email",
          action: "open",
          detail: "inbox",
        }, "test"),
      );
    }

    const agg = tracker.getAggregate("email", "open");
    expect(agg).toBeDefined();
    expect(agg!.totalCount).toBe(5);
    expect(agg!.detailCounts["inbox"]).toBe(5);
  });

  it("tracks hour and day histograms", () => {
    eventBus.emit(
      createEvent("user.interaction", {
        wasPlanned: false,
        domain: "calendar",
        action: "view",
      }, "test"),
    );

    const agg = tracker.getAggregate("calendar", "view");
    expect(agg).toBeDefined();
    expect(agg!.hourHistogram.length).toBe(24);
    expect(agg!.dayHistogram.length).toBe(7);

    // Current hour should have a count of 1
    const currentHour = new Date().getHours();
    expect(agg!.hourHistogram[currentHour]).toBe(1);
  });

  it("supports manual record() for non-event sources", () => {
    tracker.record({
      domain: "contact",
      action: "favorite",
      detail: "alice",
      timestamp: Date.now(),
      hourOfDay: 14,
      dayOfWeek: 2,
    });

    const agg = tracker.getAggregate("contact", "favorite");
    expect(agg).toBeDefined();
    expect(agg!.totalCount).toBe(1);
    expect(agg!.detailCounts["alice"]).toBe(1);
    expect(agg!.hourHistogram[14]).toBe(1);
    expect(agg!.dayHistogram[2]).toBe(1);
  });

  it("getAllAggregates returns all tracked behaviors", () => {
    tracker.record({
      domain: "email",
      action: "sort",
      timestamp: Date.now(),
      hourOfDay: 9,
      dayOfWeek: 1,
    });
    tracker.record({
      domain: "calendar",
      action: "view",
      timestamp: Date.now(),
      hourOfDay: 10,
      dayOfWeek: 1,
    });

    const all = tracker.getAllAggregates();
    expect(all.length).toBe(2);
  });

  it("accepts blockType and interactionType as fallback payload keys", () => {
    eventBus.emit(
      createEvent("user.interaction", {
        wasPlanned: false,
        blockType: "inbox",
        interactionType: "click",
      }, "test"),
    );

    const agg = tracker.getAggregate("inbox", "click");
    expect(agg).toBeDefined();
    expect(agg!.totalCount).toBe(1);
  });
});
