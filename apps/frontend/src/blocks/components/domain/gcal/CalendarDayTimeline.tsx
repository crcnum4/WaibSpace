import type { BlockProps } from "../../../registry";

/**
 * Deterministic color from a string hash.
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
 * Parse "HH:MM" to fractional hours.
 */
function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h + (m || 0) / 60;
}

/**
 * Format a Date to a short time string (e.g., "2:30 PM").
 */
function shortTime(iso: string): string {
  const d = new Date(iso);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const minStr = minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";
  return `${hours}${minStr} ${ampm}`;
}

/**
 * Format an hour number to a label: 8 -> "8 AM", 13 -> "1 PM".
 */
function hourLabel(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h} ${ampm}`;
}

export function CalendarDayTimeline({ block }: BlockProps) {
  const {
    events = [],
    freeSlots = [],
    dayStart = "08:00",
    dayEnd = "20:00",
  } = block.props as {
    date: string;
    events: Array<{
      eventId: string;
      title: string;
      start: string;
      end: string;
      color?: string;
    }>;
    freeSlots: Array<{ start: string; end: string }>;
    dayStart?: string;
    dayEnd?: string;
  };

  const startHour = parseHHMM(dayStart);
  const endHour = parseHHMM(dayEnd);
  const totalHours = endHour - startHour;

  // Build hour markers
  const hours: number[] = [];
  for (let h = Math.floor(startHour); h <= Math.floor(endHour); h++) {
    hours.push(h);
  }

  /**
   * Convert ISO datetime to a percentage position within the timeline.
   */
  function toPercent(iso: string): number {
    const d = new Date(iso);
    const fractionalHour = d.getHours() + d.getMinutes() / 60;
    return ((fractionalHour - startHour) / totalHours) * 100;
  }

  // Current time indicator
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNowLine = nowHour >= startHour && nowHour <= endHour;
  const nowPercent = ((nowHour - startHour) / totalHours) * 100;

  return (
    <div className="gcal-day-timeline">
      {/* Hour markers */}
      <div className="gcal-day-timeline__markers">
        {hours.map((h) => {
          const top = ((h - startHour) / totalHours) * 100;
          return (
            <div
              key={h}
              className="gcal-day-timeline__hour-label"
              style={{ top: `${top}%` }}
            >
              {hourLabel(h)}
            </div>
          );
        })}
      </div>

      {/* Timeline track */}
      <div className="gcal-day-timeline__track">
        {/* Hour grid lines */}
        {hours.map((h) => {
          const top = ((h - startHour) / totalHours) * 100;
          return (
            <div
              key={h}
              className="gcal-day-timeline__grid-line"
              style={{ top: `${top}%` }}
            />
          );
        })}

        {/* Free slots */}
        {freeSlots.map((slot, i) => {
          const top = toPercent(slot.start);
          const bottom = toPercent(slot.end);
          const height = bottom - top;
          if (height <= 0) return null;
          return (
            <div
              key={`free-${i}`}
              className="gcal-day-timeline__free-slot"
              style={{ top: `${top}%`, height: `${height}%` }}
            />
          );
        })}

        {/* Event blocks */}
        {events.map((evt) => {
          const top = toPercent(evt.start);
          const bottom = toPercent(evt.end);
          const height = Math.max(bottom - top, 2); // min 2% so it's visible
          const color = evt.color || colorFromTitle(evt.title);
          return (
            <div
              key={evt.eventId}
              className="gcal-day-timeline__event"
              style={{
                top: `${top}%`,
                height: `${height}%`,
                borderLeftColor: color,
              }}
            >
              <span className="gcal-day-timeline__event-title">
                {evt.title}
              </span>
              <span className="gcal-day-timeline__event-time">
                {shortTime(evt.start)} – {shortTime(evt.end)}
              </span>
            </div>
          );
        })}

        {/* Current time indicator */}
        {showNowLine && (
          <div
            className="gcal-day-timeline__now-line"
            style={{ top: `${nowPercent}%` }}
          />
        )}
      </div>
    </div>
  );
}
