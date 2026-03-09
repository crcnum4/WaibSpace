import { registerBlocks } from "../../../registry";

import { CalendarEventCard } from "./CalendarEventCard";
import { CalendarDayTimeline } from "./CalendarDayTimeline";
import { CalendarSummary } from "./CalendarSummary";

/**
 * Register all Google Calendar domain block components.
 * Call this at application startup alongside other block registrations.
 */
export function registerCalendarComponents(): void {
  registerBlocks([
    {
      type: "CalendarEventCard",
      component: CalendarEventCard,
      registration: {
        type: "CalendarEventCard",
        category: "domain",
        source: "gcal.waib",
        description: "Individual calendar event card with time, location, and attendees",
      },
    },
    {
      type: "CalendarDayTimeline",
      component: CalendarDayTimeline,
      registration: {
        type: "CalendarDayTimeline",
        category: "domain",
        source: "gcal.waib",
        description: "Vertical timeline showing a full day of events with hour markers",
      },
    },
    {
      type: "CalendarSummary",
      component: CalendarSummary,
      registration: {
        type: "CalendarSummary",
        category: "domain",
        source: "gcal.waib",
        description: "Compact summary card with event count, free slots, and next event",
      },
    },
  ]);
}
