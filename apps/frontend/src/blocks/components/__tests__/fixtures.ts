/**
 * Test fixtures — representative data for block component visual regression tests.
 *
 * Each fixture mirrors the prop shapes consumed by its target component.
 * Keep these stable; changing fixture data will (intentionally) cause
 * snapshot diffs so layout regressions are caught.
 */

// ---------------------------------------------------------------------------
// GmailEmailCard fixtures
// ---------------------------------------------------------------------------

export const gmailEmailCard = {
  /** Standard unread email with urgency badge */
  unread: {
    emailId: "msg-001",
    threadId: "thread-001",
    from: "Alice Johnson",
    subject: "Q3 Revenue Report — Action Required",
    snippet:
      "Hey team, please review the attached Q3 numbers before Friday's board meeting. Key highlights…",
    date: "Mar 7",
    isUnread: true,
    labels: ["IMPORTANT", "INBOX"],
    urgency: "high" as const,
  },

  /** Read email, no urgency */
  read: {
    emailId: "msg-002",
    threadId: "thread-002",
    from: "Bob Martinez",
    subject: "Lunch next week?",
    snippet:
      "Are you free Tuesday or Wednesday? There's a new ramen spot downtown I've been wanting to try.",
    date: "Mar 5",
    isUnread: false,
    labels: ["INBOX"],
  },

  /** Starred email with suggested reply */
  starred: {
    emailId: "msg-003",
    threadId: "thread-003",
    from: "Carol Wei",
    subject: "Design review feedback",
    snippet:
      "Overall looks great! A few minor tweaks on the navigation component — see inline comments.",
    date: "Mar 6",
    isUnread: true,
    labels: ["STARRED", "INBOX"],
    urgency: "medium" as const,
    suggestedReply: "Thanks Carol, I'll address those comments today.",
  },

  /** Minimal — no labels, no urgency */
  minimal: {
    emailId: "msg-004",
    from: "notifications@github.com",
    subject: "",
    snippet: "You were mentioned in a comment on issue #42.",
    date: "Mar 4",
    isUnread: false,
    labels: [],
  },
};

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

// ---------------------------------------------------------------------------
// GmailInboxList fixtures
// ---------------------------------------------------------------------------

export const gmailInboxList = {
  /** Normal inbox with unread emails */
  normal: {
    unreadCount: 3,
    totalCount: 5,
    isScanned: true,
  },

  /** Inbox not yet scanned */
  unscanned: {
    unreadCount: 0,
    totalCount: 10,
    isScanned: false,
  },

  /** Inbox with error */
  error: {
    unreadCount: 0,
    totalCount: 0,
    isScanned: false,
    error: "Failed to connect to Gmail. Please re-authenticate.",
  },

  /** Truncated inbox */
  truncated: {
    unreadCount: 5,
    totalCount: 25,
    isScanned: true,
    isTruncated: true,
    fullCount: 142,
  },
};
