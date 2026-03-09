import type {
  ComponentBlock,
  SurfaceSpec,
  EmitAction,
} from "@waibspace/types";
import type { ApprovalSurfaceData } from "@waibspace/surfaces";

export function approvalToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const data = spec.data as ApprovalSurfaceData;
  const sid = spec.surfaceId;

  const children: ComponentBlock[] = [];

  // Action description
  children.push({
    id: `${sid}-description`,
    type: "Text",
    props: { content: data.actionDescription, variant: "h3" },
  });

  // Context
  children.push({
    id: `${sid}-context`,
    type: "Text",
    props: {
      content:
        typeof data.context === "string"
          ? data.context
          : JSON.stringify(data.context, null, 2),
      variant: "body",
    },
  });

  // Consequences list
  if (data.consequences && data.consequences.length > 0) {
    const consequenceItems: ComponentBlock[] = data.consequences.map(
      (consequence, i) => ({
        id: `${sid}-consequence-${i}`,
        type: "Text",
        props: { content: consequence, variant: "body" },
      }),
    );

    children.push({
      id: `${sid}-consequences`,
      type: "List",
      props: {},
      children: consequenceItems,
    });
  }

  // Approve / Deny buttons in a row
  children.push({
    id: `${sid}-buttons`,
    type: "Row",
    props: { gap: "8px" },
    children: [
      {
        id: `${sid}-approve-btn`,
        type: "Button",
        props: { label: "Approve", variant: "primary" },
        events: {
          onClick: {
            action: "emit",
            event: "approval",
            payload: {
              approvalId: data.approvalId,
              approved: true,
            },
          } satisfies EmitAction,
        },
      },
      {
        id: `${sid}-deny-btn`,
        type: "Button",
        props: { label: "Deny", variant: "secondary" },
        events: {
          onClick: {
            action: "emit",
            event: "approval",
            payload: {
              approvalId: data.approvalId,
              approved: false,
            },
          } satisfies EmitAction,
        },
      },
    ],
  });

  return [
    {
      id: `${sid}-root`,
      type: "Container",
      props: { direction: "column", gap: "12px", padding: "var(--space-5)" },
      children,
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: "approval",
        provenance: spec.provenance,
        layoutHints: {
          ...spec.layoutHints,
          position: "overlay",
        },
      },
    },
  ];
}
