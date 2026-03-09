import type { BlockProps } from "../../../registry";

/**
 * Deterministic color from a string hash — produces a hue for the left border,
 * similar to how Google Calendar assigns colors to events.
 */
function colorFromTitle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Format an ISO datetime pair as a human-readable time range.
 * Examples: "2:00 – 3:30 PM", "All Day"
 */
function formatTimeRange(start: string, end: string, isAllDay?: boolean): string {
  if (isAllDay) return "All Day";

  const s = new Date(start);
  const e = new Date(end);

  const fmt = (d: Date, forceAmPm: boolean): string => {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const minStr = minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";
    return forceAmPm ? `${hours}${minStr} ${ampm}` : `${hours}${minStr}`;
  };

  const sameAmPm =
    (s.getHours() < 12 && e.getHours() < 12) ||
    (s.getHours() >= 12 && e.getHours() >= 12);

  return `${fmt(s, !sameAmPm)} – ${fmt(e, true)}`;
}

export function CalendarEventCard({ block }: BlockProps) {
  const {
    title = "",
    start = "",
    end = "",
    location,
    attendees,
    status = "confirmed",
    conflictWith,
    isAllDay,
  } = block.props as {
    eventId: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    attendees?: string[];
    status: string;
    conflictWith?: string;
    isAllDay?: boolean;
  };

  const borderColor = colorFromTitle(title);
  const isCancelled = status === "cancelled";
  const attendeeCount = attendees?.length ?? 0;

  const rootClass = [
    "gcal-event-card",
    isCancelled && "gcal-event-card--cancelled",
    status === "tentative" && "gcal-event-card--tentative",
    conflictWith && "gcal-event-card--conflict",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} style={{ borderLeftColor: borderColor }}>
      <div className="gcal-event-card__time">
        {formatTimeRange(start, end, isAllDay)}
      </div>

      <div className="gcal-event-card__title">{title}</div>

      {location && (
        <div className="gcal-event-card__location">{location}</div>
      )}

      <div className="gcal-event-card__footer">
        {attendeeCount > 0 && (
          <span className="gcal-event-card__attendees">
            +{attendeeCount} attendee{attendeeCount !== 1 ? "s" : ""}
          </span>
        )}

        {conflictWith && (
          <span className="gcal-event-card__conflict-badge">
            Conflict
          </span>
        )}
      </div>
    </div>
  );
}
