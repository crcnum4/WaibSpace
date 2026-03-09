import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CalendarEventCard } from "../domain/gcal/CalendarEventCard";
import { makeBlock } from "./test-utils";
import { calendarEventCard as fixtures } from "./fixtures";

function renderCard(props: Record<string, unknown>) {
  const block = makeBlock("CalendarEventCard", props);
  return render(<CalendarEventCard block={block} onEvent={vi.fn()} />);
}

describe("CalendarEventCard", () => {
  // -----------------------------------------------------------------------
  // Snapshot tests
  // -----------------------------------------------------------------------

  it("matches snapshot: standard meeting", () => {
    const { container } = renderCard(fixtures.meeting);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: all-day event", () => {
    const { container } = renderCard(fixtures.allDay);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: tentative event", () => {
    const { container } = renderCard(fixtures.tentative);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: cancelled event", () => {
    const { container } = renderCard(fixtures.cancelled);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: conflicting event", () => {
    const { container } = renderCard(fixtures.conflict);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  // -----------------------------------------------------------------------
  // Structural assertions
  // -----------------------------------------------------------------------

  it("displays event title", () => {
    renderCard(fixtures.meeting);
    const title = document.querySelector(".gcal-event-card__title");
    expect(title?.textContent).toBe("Sprint Planning");
  });

  it("displays location when provided", () => {
    renderCard(fixtures.meeting);
    const loc = document.querySelector(".gcal-event-card__location");
    expect(loc).toBeInTheDocument();
    expect(loc?.textContent).toBe("Conference Room B");
  });

  it("does not render location when absent", () => {
    renderCard(fixtures.tentative);
    const loc = document.querySelector(".gcal-event-card__location");
    expect(loc).not.toBeInTheDocument();
  });

  it("shows 'All Day' for all-day events", () => {
    renderCard(fixtures.allDay);
    const time = document.querySelector(".gcal-event-card__time");
    expect(time?.textContent).toBe("All Day");
  });

  it("shows attendee count", () => {
    renderCard(fixtures.meeting);
    const attendees = document.querySelector(".gcal-event-card__attendees");
    expect(attendees?.textContent).toMatch(/\+3 attendees/);
  });

  it("applies --cancelled modifier class", () => {
    const { container } = renderCard(fixtures.cancelled);
    expect(container.firstElementChild).toHaveClass(
      "gcal-event-card--cancelled",
    );
  });

  it("applies --tentative modifier class", () => {
    const { container } = renderCard(fixtures.tentative);
    expect(container.firstElementChild).toHaveClass(
      "gcal-event-card--tentative",
    );
  });

  it("applies --conflict modifier and shows conflict badge", () => {
    const { container } = renderCard(fixtures.conflict);
    expect(container.firstElementChild).toHaveClass(
      "gcal-event-card--conflict",
    );
    const badge = document.querySelector(".gcal-event-card__conflict-badge");
    expect(badge?.textContent).toBe("Conflict");
  });

  it("has a colored left border derived from title", () => {
    const { container } = renderCard(fixtures.meeting);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.borderLeftColor).toMatch(/^hsl\(/);
  });
});
