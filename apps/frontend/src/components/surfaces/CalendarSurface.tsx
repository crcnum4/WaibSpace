import type { SurfaceProps } from "./registry";
import type { CalendarSurfaceData } from "@waibspace/surfaces";

export function CalendarSurface({
  spec,
  onAction,
  onInteraction,
}: SurfaceProps) {
  const data = spec.data as CalendarSurfaceData;

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const eventColors = [
    "#6366f1",
    "#8b5cf6",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ec4899",
  ];

  return (
    <div className="surface calendar-surface">
      <div className="surface-header">
        <h3>{spec.title}</h3>
        <span className="calendar-range">
          {formatDate(data.dateRange.start)} &ndash;{" "}
          {formatDate(data.dateRange.end)}
        </span>
      </div>
      <div className="calendar-timeline">
        {data.events.map((event, idx) => (
          <div
            key={event.id}
            className={`calendar-event ${event.conflictWith ? "has-conflict" : ""}`}
            style={{
              borderLeftColor: eventColors[idx % eventColors.length],
            }}
            onClick={() => onInteraction("click", event.id)}
          >
            <div className="calendar-event-time">
              {formatTime(event.start)} &ndash; {formatTime(event.end)}
            </div>
            <div className="calendar-event-title">{event.title}</div>
            {event.location && (
              <div className="calendar-event-location">{event.location}</div>
            )}
            {event.attendees && event.attendees.length > 0 && (
              <div className="calendar-event-attendees">
                {event.attendees.join(", ")}
              </div>
            )}
            {event.conflictWith && (
              <div className="calendar-conflict-warning">
                Conflicts with: {event.conflictWith}
              </div>
            )}
          </div>
        ))}

        {data.freeSlots.length > 0 && (
          <div className="calendar-free-slots">
            <div className="calendar-free-label">Available slots</div>
            {data.freeSlots.map((slot, idx) => (
              <div key={idx} className="calendar-free-slot">
                {formatTime(slot.start)} &ndash; {formatTime(slot.end)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="surface-actions">
        <button
          className="action-btn risk-B"
          onClick={() => onInteraction("reschedule", "calendar")}
        >
          Reschedule
        </button>
        <button
          className="action-btn risk-A"
          onClick={() => onInteraction("add-event", "calendar")}
        >
          Add Event
        </button>
        {spec.actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action)}
            className={`action-btn risk-${action.riskClass}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
