import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";
import type { CalendarSurfaceData } from "@waibspace/surfaces";

export function calendarToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const data = spec.data as CalendarSurfaceData;
  const sid = spec.surfaceId;

  const children: ComponentBlock[] = [];

  // Header
  children.push({
    id: `${sid}-header`,
    type: "Text",
    props: { content: spec.title, variant: "h3", color: "var(--color-text)" },
  });

  // Events list
  if (data.events && data.events.length > 0) {
    const eventItems: ComponentBlock[] = data.events.map((event, i) => {
      const rowChildren: ComponentBlock[] = [
        {
          id: `${sid}-event-time-${i}`,
          type: "Text",
          props: {
            content: `${event.start} – ${event.end}`,
            variant: "body",
          },
        },
        {
          id: `${sid}-event-stack-${i}`,
          type: "Stack",
          props: { gap: "2px" },
          children: [
            {
              id: `${sid}-event-title-${i}`,
              type: "Text",
              props: { content: event.title, variant: "body" },
            },
            ...(event.location
              ? [
                  {
                    id: `${sid}-event-location-${i}`,
                    type: "Text",
                    props: {
                      content: event.location,
                      variant: "caption",
                    },
                  } satisfies ComponentBlock,
                ]
              : []),
          ],
        },
      ];

      // Conflict badge
      if (event.conflictWith) {
        rowChildren.push({
          id: `${sid}-event-conflict-${i}`,
          type: "Badge",
          props: { label: "Conflict", color: "red" },
        });
      }

      return {
        id: `${sid}-event-item-${i}`,
        type: "ListItem",
        props: {},
        children: [
          {
            id: `${sid}-event-row-${i}`,
            type: "Row",
            props: { gap: "12px", align: "center" },
            children: rowChildren,
          },
        ],
      } satisfies ComponentBlock;
    });

    children.push({
      id: `${sid}-event-list`,
      type: "List",
      props: {},
      children: eventItems,
    });
  }

  // Free slots
  if (data.freeSlots && data.freeSlots.length > 0) {
    children.push({
      id: `${sid}-freeslots-label`,
      type: "Text",
      props: { content: "Available Slots", variant: "h3" },
    });

    const slotItems: ComponentBlock[] = data.freeSlots.map((slot, i) => ({
      id: `${sid}-freeslot-item-${i}`,
      type: "ListItem",
      props: {},
      children: [
        {
          id: `${sid}-freeslot-time-${i}`,
          type: "Text",
          props: {
            content: `${slot.start} – ${slot.end}`,
            variant: "body",
          },
        },
      ],
    }));

    children.push({
      id: `${sid}-freeslot-list`,
      type: "List",
      props: {},
      children: slotItems,
    });
  }

  return [
    {
      id: `${sid}-root`,
      type: "Container",
      props: { direction: "column", gap: "12px", padding: "var(--space-5)" },
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
