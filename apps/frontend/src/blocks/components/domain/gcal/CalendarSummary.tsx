import type { BlockProps } from "../../../registry";

/**
 * Format an ISO date string as a friendly label.
 * If the date is today: "Today, March 9"
 * Otherwise: "Monday, March 9"
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();

  if (isToday) return `Today, ${month} ${day}`;

  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${month} ${day}`;
}

export function CalendarSummary({ block }: BlockProps) {
  const {
    date = "",
    eventCount = 0,
    nextEvent,
    freeSlotCount = 0,
    conflicts = 0,
  } = block.props as {
    date: string;
    eventCount: number;
    nextEvent?: { title: string; start: string; minutesUntil: number };
    freeSlotCount: number;
    conflicts: number;
  };

  const isUrgent = nextEvent != null && nextEvent.minutesUntil < 30;

  return (
    <div className="gcal-summary">
      <div className="gcal-summary__date">{formatDate(date)}</div>

      <div className="gcal-summary__stats">
        <span className="gcal-summary__stat">
          {eventCount} event{eventCount !== 1 ? "s" : ""}
        </span>
        <span className="gcal-summary__stat-sep">&middot;</span>
        <span className="gcal-summary__stat">
          {freeSlotCount} free slot{freeSlotCount !== 1 ? "s" : ""}
        </span>
        {conflicts > 0 && (
          <>
            <span className="gcal-summary__stat-sep">&middot;</span>
            <span className="gcal-summary__stat gcal-summary__stat--conflict">
              {conflicts} conflict{conflicts !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {nextEvent && (
        <div
          className={`gcal-summary__next ${isUrgent ? "gcal-summary__next--urgent" : ""}`}
        >
          Next: {nextEvent.title} in {nextEvent.minutesUntil} min
        </div>
      )}
    </div>
  );
}
