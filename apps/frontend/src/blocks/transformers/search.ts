import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";
import type { SearchSurfaceData } from "@waibspace/surfaces";

export function searchToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const data = spec.data as SearchSurfaceData;
  const sid = spec.surfaceId;

  const children: ComponentBlock[] = [];

  // Header with query and result count
  children.push({
    id: `${sid}-header`,
    type: "Text",
    props: { content: `Search: "${data.query}"`, variant: "h3" },
  });

  children.push({
    id: `${sid}-summary`,
    type: "Text",
    props: {
      content: `${data.totalResults} result${data.totalResults !== 1 ? "s" : ""} across ${data.sources.join(", ")}`,
      variant: "caption",
    },
  });

  // Results list
  if (data.results && data.results.length > 0) {
    const resultItems: ComponentBlock[] = data.results.map((result, i) => {
      const itemChildren: ComponentBlock[] = [
        {
          id: `${sid}-result-stack-${i}`,
          type: "Stack",
          props: { gap: "4px" },
          children: [
            {
              id: `${sid}-result-title-${i}`,
              type: "Text",
              props: { content: result.title, variant: "h3" },
            },
            {
              id: `${sid}-result-snippet-${i}`,
              type: "Text",
              props: { content: result.snippet, variant: "body" },
            },
            {
              id: `${sid}-result-meta-${i}`,
              type: "Row",
              props: { gap: "8px" },
              children: [
                {
                  id: `${sid}-result-source-${i}`,
                  type: "Badge",
                  props: {
                    label: result.source,
                    color: getSourceColor(result.sourceType),
                  },
                },
                ...(result.date
                  ? [
                      {
                        id: `${sid}-result-date-${i}`,
                        type: "Text",
                        props: { content: result.date, variant: "caption" },
                      } satisfies ComponentBlock,
                    ]
                  : []),
                {
                  id: `${sid}-result-score-${i}`,
                  type: "Badge",
                  props: {
                    label: `${Math.round(result.relevanceScore * 100)}%`,
                    color: "blue",
                  },
                },
              ],
            },
            // Metadata tags
            ...(result.metadata
              ? Object.entries(result.metadata).map(
                  ([key, value], mi) =>
                    ({
                      id: `${sid}-result-tag-${i}-${mi}`,
                      type: "Badge",
                      props: {
                        label: `${key}: ${value}`,
                        color: "gray",
                      },
                    }) satisfies ComponentBlock,
                )
              : []),
          ],
        },
      ];

      return {
        id: `${sid}-result-item-${i}`,
        type: "ListItem",
        props: {},
        children: itemChildren,
      } satisfies ComponentBlock;
    });

    children.push({
      id: `${sid}-result-list`,
      type: "List",
      props: {},
      children: resultItems,
    });
  } else {
    children.push({
      id: `${sid}-no-results`,
      type: "Text",
      props: {
        content: `No results found for "${data.query}". Try a different search term.`,
        variant: "body",
      },
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
        surfaceType: "search",
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}

function getSourceColor(sourceType: string): string {
  switch (sourceType) {
    case "email":
      return "red";
    case "calendar-event":
      return "green";
    case "message":
      return "purple";
    case "issue":
    case "pull-request":
      return "orange";
    default:
      return "blue";
  }
}
