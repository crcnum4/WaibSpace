import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";

interface GenericSection {
  heading: string;
  items: Array<{
    label: string;
    detail?: string;
    metadata?: Record<string, string>;
    timestamp?: string;
    url?: string;
  }>;
}

interface GenericPresentation {
  title?: string;
  summary?: string;
  sections?: GenericSection[];
}

function isStructuredData(data: unknown): data is GenericPresentation {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.sections);
}

export function genericToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const sid = spec.surfaceId;
  const data = spec.data as unknown;

  if (!isStructuredData(data)) {
    // Fallback: JSON dump (same as before)
    return [
      {
        id: `${sid}-root`,
        type: "Container",
        props: { direction: "column", gap: "12px", padding: "var(--space-5)" },
        children: [
          {
            id: `${sid}-header`,
            type: "Text",
            props: { content: spec.title, variant: "h3" },
          },
          {
            id: `${sid}-body`,
            type: "Text",
            props: {
              content: JSON.stringify(data, null, 2),
              variant: "body",
            },
          },
        ],
        meta: {
          surfaceId: spec.surfaceId,
          surfaceType: spec.surfaceType,
          provenance: spec.provenance,
          layoutHints: spec.layoutHints,
        },
      },
    ];
  }

  // Build structured blocks from GenericDataPresentation
  const children: ComponentBlock[] = [];

  // Header
  children.push({
    id: `${sid}-title`,
    type: "Text",
    props: { content: spec.title || data.title || "Data", variant: "h3" },
  });

  if (data.summary) {
    children.push({
      id: `${sid}-summary`,
      type: "Text",
      props: { content: data.summary, variant: "body", color: "var(--text-secondary)" },
    });
  }

  // Sections
  for (let si = 0; si < data.sections!.length; si++) {
    const section = data.sections![si];
    const sectionChildren: ComponentBlock[] = [];

    sectionChildren.push({
      id: `${sid}-s${si}-heading`,
      type: "Text",
      props: { content: section.heading, variant: "h4" },
    });

    // Items as ListItems
    const listItems: ComponentBlock[] = [];
    for (let ii = 0; ii < section.items.length; ii++) {
      const item = section.items[ii];
      const itemChildren: ComponentBlock[] = [];

      // Main row: label + timestamp
      const mainRowChildren: ComponentBlock[] = [
        {
          id: `${sid}-s${si}-i${ii}-label`,
          type: "Text",
          props: { content: item.label, variant: "body" },
        },
      ];
      if (item.timestamp) {
        mainRowChildren.push({
          id: `${sid}-s${si}-i${ii}-time`,
          type: "Text",
          props: { content: item.timestamp, variant: "caption", color: "var(--text-secondary)" },
        });
      }
      itemChildren.push({
        id: `${sid}-s${si}-i${ii}-main`,
        type: "Row",
        props: { justify: "space-between", align: "center", gap: "8px" },
        children: mainRowChildren,
      });

      // Detail
      if (item.detail) {
        itemChildren.push({
          id: `${sid}-s${si}-i${ii}-detail`,
          type: "Text",
          props: { content: item.detail, variant: "caption", color: "var(--text-secondary)" },
        });
      }

      // Metadata badges
      if (item.metadata && Object.keys(item.metadata).length > 0) {
        const badges: ComponentBlock[] = Object.entries(item.metadata).map(
          ([key, value], bi) => ({
            id: `${sid}-s${si}-i${ii}-b${bi}`,
            type: "Badge",
            props: { content: `${key}: ${value}`, variant: "label" },
          }),
        );
        itemChildren.push({
          id: `${sid}-s${si}-i${ii}-badges`,
          type: "Row",
          props: { gap: "4px" },
          children: badges,
        });
      }

      listItems.push({
        id: `${sid}-s${si}-i${ii}`,
        type: "ListItem",
        props: {},
        children: itemChildren,
      });
    }

    sectionChildren.push({
      id: `${sid}-s${si}-list`,
      type: "List",
      props: { gap: "4px" },
      children: listItems,
    });

    children.push({
      id: `${sid}-s${si}`,
      type: "Container",
      props: { direction: "column", gap: "8px" },
      children: sectionChildren,
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
        surfaceType: spec.surfaceType,
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}
