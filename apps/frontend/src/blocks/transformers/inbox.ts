import type {
  ComponentBlock,
  SurfaceSpec,
  SurfaceAction,
  EmitAction,
} from "@waibspace/types";
import type { InboxSurfaceData } from "@waibspace/surfaces";

function urgencyColor(urgency: string): string {
  switch (urgency) {
    case "high":
      return "red";
    case "medium":
      return "yellow";
    case "low":
      return "blue";
    default:
      return "gray";
  }
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

export function inboxToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const data = spec.data as InboxSurfaceData;
  const sid = spec.surfaceId;

  const children: ComponentBlock[] = [];

  // Header
  children.push({
    id: `${sid}-header`,
    type: "Text",
    props: { content: spec.title, variant: "h3", color: "var(--color-text)" },
  });

  // Email list
  if (data.emails && data.emails.length > 0) {
    const emailItems: ComponentBlock[] = data.emails.map((email, i) => {
      const rowChildren: ComponentBlock[] = [
        {
          id: `${sid}-email-badge-${i}`,
          type: "Badge",
          props: { label: email.urgency, color: urgencyColor(email.urgency) },
        },
        {
          id: `${sid}-email-stack-${i}`,
          type: "Stack",
          props: { gap: "2px" },
          children: [
            {
              id: `${sid}-email-from-${i}`,
              type: "Text",
              props: { content: email.from, variant: "body" },
            },
            {
              id: `${sid}-email-subject-${i}`,
              type: "Text",
              props: { content: email.subject, variant: "bold" },
            },
            {
              id: `${sid}-email-snippet-${i}`,
              type: "Text",
              props: { content: email.snippet, variant: "caption" },
            },
          ],
        },
      ];

      const itemChildren: ComponentBlock[] = [
        {
          id: `${sid}-email-row-${i}`,
          type: "Row",
          props: { gap: "12px", align: "center" },
          children: rowChildren,
        },
      ];

      // Suggested reply expandable
      if (email.suggestedReply) {
        itemChildren.push({
          id: `${sid}-email-expand-${i}`,
          type: "Expandable",
          props: { label: "Suggested Reply" },
          children: [
            {
              id: `${sid}-email-reply-input-${i}`,
              type: "TextInput",
              props: {
                placeholder: "Edit reply...",
                defaultValue: email.suggestedReply,
              },
            },
            {
              id: `${sid}-email-reply-btn-${i}`,
              type: "Button",
              props: { label: "Send Reply", variant: "primary" },
              events: {
                onClick: {
                  action: "emit",
                  event: "user.interaction",
                  payload: {
                    actionType: "email.send",
                    emailId: email.id,
                    from: email.from,
                    subject: email.subject,
                  },
                } satisfies EmitAction,
              },
            },
          ],
        });
      }

      return {
        id: `${sid}-email-item-${i}`,
        type: "ListItem",
        props: {},
        children: itemChildren,
      } satisfies ComponentBlock;
    });

    children.push({
      id: `${sid}-email-list`,
      type: "List",
      props: {},
      children: emailItems,
    });
  }

  // Actions
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
      props: { direction: "column", gap: "12px", padding: "var(--space-5)" },
      children,
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: "inbox",
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}
