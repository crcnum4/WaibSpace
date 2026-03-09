import type { CalendarEvent, FreeSlot } from "./types";

/**
 * Generate fixture events relative to "today" so they always look fresh.
 */
function today(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function tomorrow(hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const FIXTURE_EVENTS: CalendarEvent[] = [
  {
    id: "cal-evt-1",
    summary: "Standup",
    start: today(9, 0),
    end: today(9, 15),
    location: "Zoom",
    attendees: ["alice@example.com", "bob@example.com"],
    status: "confirmed",
  },
  {
    id: "cal-evt-2",
    summary: "Product Review",
    start: today(10, 30),
    end: today(11, 30),
    location: "Conference Room B",
    attendees: ["carol@example.com", "dave@example.com", "eve@example.com"],
    status: "confirmed",
  },
  {
    id: "cal-evt-3",
    summary: "Lunch with Investors",
    start: today(12, 0),
    end: today(13, 0),
    location: "Downtown Grill",
    description: "Q1 review discussion",
    status: "confirmed",
  },
  {
    id: "cal-evt-4",
    summary: "Sprint Planning",
    start: today(14, 0),
    end: today(15, 0),
    location: "Zoom",
    attendees: ["alice@example.com", "frank@example.com"],
    status: "confirmed",
  },
  {
    id: "cal-evt-5",
    summary: "1:1 with Manager",
    start: today(16, 0),
    end: today(16, 30),
    status: "confirmed",
  },
  {
    id: "cal-evt-6",
    summary: "Team Retro",
    start: tomorrow(10, 0),
    end: tomorrow(11, 0),
    location: "Zoom",
    attendees: ["alice@example.com", "bob@example.com", "carol@example.com"],
    status: "confirmed",
  },
  {
    id: "cal-evt-7",
    summary: "Design Review",
    start: tomorrow(14, 0),
    end: tomorrow(15, 0),
    location: "Conference Room A",
    status: "confirmed",
  },
];

/**
 * Compute free slots between events for a given time range.
 */
export function computeFreeSlots(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): FreeSlot[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  const slots: FreeSlot[] = [];
  let cursor = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();

  for (const evt of sorted) {
    const evtStart = new Date(evt.start).getTime();
    const evtEnd = new Date(evt.end).getTime();
    if (evtStart > cursor && evtStart <= end) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(evtStart).toISOString(),
      });
    }
    if (evtEnd > cursor) cursor = evtEnd;
  }

  if (cursor < end) {
    slots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(end).toISOString(),
    });
  }

  return slots;
}
