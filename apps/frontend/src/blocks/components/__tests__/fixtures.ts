/**
 * Test fixtures — representative data for block component visual regression tests.
 *
 * Each fixture mirrors the prop shapes consumed by its target component.
 * Keep these stable; changing fixture data will (intentionally) cause
 * snapshot diffs so layout regressions are caught.
 */

// ---------------------------------------------------------------------------
// CalendarEventCard fixtures
// ---------------------------------------------------------------------------

export const calendarEventCard = {
  /** Standard meeting with attendees */
  meeting: {
    eventId: "evt-001",
    title: "Sprint Planning",
    start: "2026-03-09T10:00:00",
    end: "2026-03-09T11:00:00",
    location: "Conference Room B",
    attendees: ["alice@co.com", "bob@co.com", "carol@co.com"],
    status: "confirmed",
  },

  /** All-day event */
  allDay: {
    eventId: "evt-002",
    title: "Company Offsite",
    start: "2026-03-10T00:00:00",
    end: "2026-03-10T23:59:59",
    status: "confirmed",
    isAllDay: true,
  },

  /** Tentative event */
  tentative: {
    eventId: "evt-003",
    title: "1:1 with Manager",
    start: "2026-03-09T14:00:00",
    end: "2026-03-09T14:30:00",
    status: "tentative",
    attendees: ["manager@co.com"],
  },

  /** Cancelled event */
  cancelled: {
    eventId: "evt-004",
    title: "Team Lunch",
    start: "2026-03-09T12:00:00",
    end: "2026-03-09T13:00:00",
    location: "Cafeteria",
    status: "cancelled",
  },

  /** Conflicting event */
  conflict: {
    eventId: "evt-005",
    title: "Design Review",
    start: "2026-03-09T10:30:00",
    end: "2026-03-09T11:30:00",
    status: "confirmed",
    conflictWith: "evt-001",
    attendees: ["designer@co.com", "pm@co.com"],
  },
};

// ---------------------------------------------------------------------------
// CalendarDayTimeline fixtures
// ---------------------------------------------------------------------------

export const calendarDayTimeline = {
  /** Typical work day with events and free slots */
  workday: {
    date: "2026-03-09",
    dayStart: "08:00",
    dayEnd: "18:00",
    events: [
      {
        eventId: "evt-t1",
        title: "Stand-up",
        start: "2026-03-09T09:00:00",
        end: "2026-03-09T09:15:00",
      },
      {
        eventId: "evt-t2",
        title: "Sprint Planning",
        start: "2026-03-09T10:00:00",
        end: "2026-03-09T11:00:00",
      },
      {
        eventId: "evt-t3",
        title: "Lunch",
        start: "2026-03-09T12:00:00",
        end: "2026-03-09T13:00:00",
        color: "#4caf50",
      },
      {
        eventId: "evt-t4",
        title: "Code Review",
        start: "2026-03-09T15:00:00",
        end: "2026-03-09T16:00:00",
      },
    ],
    freeSlots: [
      { start: "2026-03-09T11:00:00", end: "2026-03-09T12:00:00" },
      { start: "2026-03-09T13:00:00", end: "2026-03-09T15:00:00" },
      { start: "2026-03-09T16:00:00", end: "2026-03-09T18:00:00" },
    ],
  },

  /** Empty day — no events */
  empty: {
    date: "2026-03-15",
    dayStart: "08:00",
    dayEnd: "18:00",
    events: [],
    freeSlots: [{ start: "2026-03-15T08:00:00", end: "2026-03-15T18:00:00" }],
  },
};

