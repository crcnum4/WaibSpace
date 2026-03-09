import type {
  ComponentBlock,
  SurfaceSpec,
  SurfaceAction,
  EmitAction,
} from "@waibspace/types";
import type { DiscoverySurfaceData } from "@waibspace/surfaces";

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

export function discoveryToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const data = spec.data as DiscoverySurfaceData;
  const sid = spec.surfaceId;

  const children: ComponentBlock[] = [];

  // Header with query
  children.push({
    id: `${sid}-header`,
    type: "Text",
    props: { content: `${spec.title}: ${data.query}`, variant: "h3" },
  });

  // Results list
  if (data.results && data.results.length > 0) {
    const resultItems: ComponentBlock[] = data.results.map((result, i) => ({
      id: `${sid}-result-item-${i}`,
      type: "ListItem",
      props: {},
      children: [
        {
          id: `${sid}-result-stack-${i}`,
          type: "Stack",
          props: {},
          children: [
            {
              id: `${sid}-result-title-${i}`,
              type: "Text",
              props: { content: result.title, variant: "h3" },
            },
            {
              id: `${sid}-result-desc-${i}`,
              type: "Text",
              props: { content: result.description, variant: "body" },
            },
            ...(result.url
              ? [
                  {
                    id: `${sid}-result-url-${i}`,
                    type: "Text",
                    props: { content: result.url, variant: "caption" },
                  } satisfies ComponentBlock,
                ]
              : []),
          ],
        },
        {
          id: `${sid}-result-badge-${i}`,
          type: "Badge",
          props: {
            label: `${Math.round(result.relevanceScore * 100)}%`,
            color: "blue",
          },
        },
      ],
    }));

    children.push({
      id: `${sid}-result-list`,
      type: "List",
      props: {},
      children: resultItems,
    });
  }

  // Actions
  if (spec.actions.length > 0) {
    children.push(
      ...spec.actions.map((action, i) => actionToButton(action, sid, i)),
    );
  }

  return [
    {
      id: `${sid}-root`,
      type: "Container",
      props: {},
      children,
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: "discovery",
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}
