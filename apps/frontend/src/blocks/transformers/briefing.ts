import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";
import type { BriefingSurfaceData, BriefingCardSpec } from "@waibspace/surfaces";

/**
 * Transform a briefing surface into ComponentBlocks that use our
 * briefing-card, action-card, insight-card, and status-card domain components.
 */
export function briefingToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const data = spec.data as BriefingSurfaceData;
  const sid = spec.surfaceId;

  if (!data?.cards || data.cards.length === 0) {
    return [
      {
        id: `${sid}-empty`,
        type: "Container",
        props: { direction: "column", padding: "var(--space-5)" },
        children: [
          {
            id: `${sid}-empty-text`,
            type: "Text",
            props: { content: "No briefing items right now.", variant: "body" },
          },
        ],
        meta: {
          surfaceId: spec.surfaceId,
          surfaceType: "briefing",
          provenance: spec.provenance,
          layoutHints: spec.layoutHints,
        },
      },
    ];
  }

  // Each BriefingCardSpec becomes a block of its cardType
  const children: ComponentBlock[] = data.cards.map(
    (card: BriefingCardSpec, i: number) => ({
      id: `${sid}-card-${i}`,
      type: card.cardType,
      props: card.data,
    }),
  );

  return [
    {
      id: `${sid}-root`,
      type: "Container",
      props: { direction: "column", gap: "16px", padding: "var(--space-5)" },
      children,
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: "briefing",
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}
