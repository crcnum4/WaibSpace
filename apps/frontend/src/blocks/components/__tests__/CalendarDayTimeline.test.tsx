import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CalendarDayTimeline } from "../domain/gcal/CalendarDayTimeline";
import { makeBlock } from "./test-utils";
import { calendarDayTimeline as fixtures } from "./fixtures";

function renderTimeline(props: Record<string, unknown>) {
  const block = makeBlock("CalendarDayTimeline", props);
  return render(<CalendarDayTimeline block={block} onEvent={vi.fn()} />);
}

describe("CalendarDayTimeline", () => {
  // -----------------------------------------------------------------------
  // Snapshot tests
  // -----------------------------------------------------------------------

  it("matches snapshot: workday with events and free slots", () => {
    // Mock Date.now so the "now" line is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T14:30:00"));
    const { container } = renderTimeline(fixtures.workday);
    expect(container.firstElementChild).toMatchSnapshot();
    vi.useRealTimers();
  });

  it("matches snapshot: empty day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    const { container } = renderTimeline(fixtures.empty);
    expect(container.firstElementChild).toMatchSnapshot();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Structural assertions
  // -----------------------------------------------------------------------

  it("renders hour marker labels for each hour in the range", () => {
    renderTimeline(fixtures.workday);
    const labels = document.querySelectorAll(
      ".gcal-day-timeline__hour-label",
    );
    // dayStart=08:00 dayEnd=18:00 -> hours 8..18 inclusive = 11 labels
    expect(labels.length).toBe(11);
    expect(labels[0].textContent).toBe("8 AM");
    expect(labels[labels.length - 1].textContent).toBe("6 PM");
  });

  it("renders one event block per event", () => {
    renderTimeline(fixtures.workday);
    const events = document.querySelectorAll(".gcal-day-timeline__event");
    expect(events.length).toBe(4);
  });

  it("renders event titles and times", () => {
    renderTimeline(fixtures.workday);
    const titles = document.querySelectorAll(
      ".gcal-day-timeline__event-title",
    );
    expect(titles[0].textContent).toBe("Stand-up");
    expect(titles[1].textContent).toBe("Sprint Planning");
  });

  it("renders free-slot blocks", () => {
    renderTimeline(fixtures.workday);
    const freeSlots = document.querySelectorAll(
      ".gcal-day-timeline__free-slot",
    );
    expect(freeSlots.length).toBe(3);
  });

  it("renders no events for an empty day", () => {
    renderTimeline(fixtures.empty);
    const events = document.querySelectorAll(".gcal-day-timeline__event");
    expect(events.length).toBe(0);
  });

  it("renders the now-line when current time is within range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T14:30:00"));
    renderTimeline(fixtures.workday);
    const nowLine = document.querySelector(".gcal-day-timeline__now-line");
    expect(nowLine).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("does not render now-line when current time is outside range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T06:00:00")); // before 8 AM
    renderTimeline(fixtures.workday);
    const nowLine = document.querySelector(".gcal-day-timeline__now-line");
    expect(nowLine).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("applies custom border-left color to events", () => {
    renderTimeline(fixtures.workday);
    const events = document.querySelectorAll(".gcal-day-timeline__event");
    // Third event (Lunch) has explicit color="#4caf50"
    const lunchEvent = events[2] as HTMLElement;
    expect(lunchEvent.style.borderLeftColor).toBe("#4caf50");
  });
});
