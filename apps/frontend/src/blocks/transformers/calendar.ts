import type {
  ComponentBlock,
  SurfaceSpec,
  SurfaceAction,
  EmitAction,
} from "@waibspace/types";
import type { CalendarSurfaceData } from "@waibspace/surfaces";

/**
 * Deterministic color from a string hash — produces an HSL hue,
 * matching the approach used in CalendarEventCard avatar logic.
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
 * Detect whether an event is "all-day" by checking if its start/end are
 * date-only strings (no "T") or span exactly 24 hours.
 */
function isAllDayEvent(start: string, end: string): boolean {
  // Date-only strings like "2026-03-09" have no "T"
  if (!start.includes("T") || !end.includes("T")) return true;

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return diffMs >= twentyFourHours;
}

/**
 * Check whether an ISO date string falls on today's date.
 */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function actionToButton(
  action: SurfaceAction,
  surfaceId: string,
  index: number,
): ComponentBlock {
  return {
    id: `${surfaceId}-action-${index}`,
    type: "Button",
    props: {
      label: action.label,
      variant: "secondary",
    },
    events: {
      onClick: {
        action: "emit",
        event: "user.interaction",
        payload: {
          actionId: action.id,
          actionType: action.actionType,
          riskClass: action.riskClass,
          payload: action.payload,
        },
      } satisfies EmitAction,
    },
  };
}

export function calendarToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const data = spec.data as CalendarSurfaceData;
  const sid = spec.surfaceId;
  const events = data.events ?? [];
  const freeSlots = data.freeSlots ?? [];

  const children: ComponentBlock[] = [];

  // ── 1. CalendarSummary ──────────────────────────────────────────────
  const conflictCount = events.filter((e) => e.conflictWith).length;
  const now = new Date();

  // Find the next upcoming event (starts in the future)
  const upcomingEvents = events
    .filter((e) => new Date(e.start).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const nextEvent = upcomingEvents[0];
  const nextEventProp = nextEvent
    ? {
        title: nextEvent.title,
        start: nextEvent.start,
        minutesUntil: Math.round(
          (new Date(nextEvent.start).getTime() - now.getTime()) / (1000 * 60),
        ),
      }
    : undefined;

  // Use dateRange.start as the summary date
  const summaryDate = data.dateRange?.start ?? new Date().toISOString();

  children.push({
    id: `${sid}-summary`,
    type: "CalendarSummary",
    props: {
      date: summaryDate,
      eventCount: events.length,
      nextEvent: nextEventProp,
      freeSlotCount: freeSlots.length,
      conflicts: conflictCount,
    },
  });

  // ── 2. CalendarDayTimeline (today's events) ─────────────────────────
  const todayEvents = events.filter((e) => isToday(e.start));
  const todayFreeSlots = freeSlots.filter((s) => isToday(s.start));

  const timelineEvents = todayEvents.map((e) => ({
    eventId: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    color: colorFromTitle(e.title),
  }));

  children.push({
    id: `${sid}-timeline`,
    type: "CalendarDayTimeline",
    props: {
      date: summaryDate,
      events: timelineEvents,
      freeSlots: todayFreeSlots.map((s) => ({ start: s.start, end: s.end })),
      dayStart: "08:00",
      dayEnd: "20:00",
    },
  });

  // ── 3. CalendarEventCard × N (upcoming events beyond today) ─────────
  const futureEvents = events.filter((e) => !isToday(e.start));
  for (let i = 0; i < futureEvents.length; i++) {
    const evt = futureEvents[i];
    children.push({
      id: `${sid}-event-${i}`,
      type: "CalendarEventCard",
      props: {
        eventId: evt.id,
        title: evt.title,
        start: evt.start,
        end: evt.end,
        location: evt.location,
        attendees: evt.attendees,
        status: "confirmed",
        conflictWith: evt.conflictWith,
        isAllDay: isAllDayEvent(evt.start, evt.end),
      },
    });
  }

  // ── 4. Actions row ──────────────────────────────────────────────────
  if (spec.actions.length > 0) {
    children.push({
      id: `${sid}-actions-row`,
      type: "Row",
      props: { gap: "8px" },
      children: spec.actions.map((action, i) => actionToButton(action, sid, i)),
    });
  }

  return [
    {
      id: `${sid}-root`,
      type: "Container",
      props: { direction: "column", gap: "16px", padding: "var(--space-5)" },
      children,
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: "calendar",
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}
