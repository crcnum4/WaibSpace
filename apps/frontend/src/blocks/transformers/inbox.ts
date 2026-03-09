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
      return "var(--color-danger)";
    case "medium":
      return "var(--color-warning)";
    case "low":
      return "var(--color-neutral)";
    default:
      return "var(--color-neutral)";
  }
}

function urgencyTextColor(urgency: string): string {
  switch (urgency) {
    case "medium":
      return "#000";
    default:
      return "#fff";
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.round(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.round(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
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

  // Header row: title + unread count badge
  const headerChildren: ComponentBlock[] = [
    {
      id: `${sid}-header`,
      type: "Text",
      props: { content: spec.title, variant: "h3", color: "var(--color-text)" },
    },
  ];
  if (data.unreadCount > 0) {
    headerChildren.push({
      id: `${sid}-unread-count`,
      type: "Badge",
      props: {
        content: `${data.unreadCount} unread`,
        variant: "count",
        color: "var(--color-accent)",
      },
    });
  }
  children.push({
    id: `${sid}-header-row`,
    type: "Row",
    props: { gap: "12px", align: "center" },
    children: headerChildren,
  });

  // Email list
  if (data.emails && data.emails.length > 0) {
    const emailItems: ComponentBlock[] = data.emails.map((email, i) => {
      // Left side: unread dot
      const rowChildren: ComponentBlock[] = [];

      if (email.isUnread) {
        rowChildren.push({
          id: `${sid}-email-dot-${i}`,
          type: "Badge",
          props: { variant: "dot", color: "var(--color-accent)" },
        });
      } else {
        // Spacer to keep alignment consistent
        rowChildren.push({
          id: `${sid}-email-dot-spacer-${i}`,
          type: "Container",
          props: { className: "inbox-block-dot-spacer" },
        });
      }

      // Content stack: sender+date row, subject, snippet
      const contentChildren: ComponentBlock[] = [
        // Top row: sender + date
        {
          id: `${sid}-email-top-${i}`,
          type: "Row",
          props: { gap: "8px", align: "center", justify: "space-between" },
          children: [
            {
              id: `${sid}-email-from-${i}`,
              type: "Text",
              props: {
                content: email.from,
                variant: "body",
                weight: email.isUnread ? "var(--weight-semibold)" : undefined,
              },
            },
            {
              id: `${sid}-email-date-${i}`,
              type: "Text",
              props: {
                content: formatRelativeTime(email.date),
                variant: "caption",
                color: "var(--color-muted)",
              },
            },
          ],
        },
        // Subject
        {
          id: `${sid}-email-subject-${i}`,
          type: "Text",
          props: {
            content: email.subject,
            variant: "label",
            weight: email.isUnread ? "var(--weight-semibold)" : "var(--weight-medium)",
          },
        },
        // Snippet
        {
          id: `${sid}-email-snippet-${i}`,
          type: "Text",
          props: {
            content: email.snippet,
            variant: "caption",
            color: "var(--color-muted)",
          },
        },
      ];

      rowChildren.push({
        id: `${sid}-email-content-${i}`,
        type: "Stack",
        props: { gap: "2px" },
        children: contentChildren,
      });

      // Urgency badge on the right (only if classified)
      if (email.urgency) {
        rowChildren.push({
          id: `${sid}-email-urgency-${i}`,
          type: "Container",
          props: { className: `inbox-block-urgency inbox-block-urgency--${email.urgency}` },
          children: [
            {
              id: `${sid}-email-urgency-text-${i}`,
              type: "Text",
              props: {
                content: email.urgency,
                variant: "caption",
                color: urgencyTextColor(email.urgency),
              },
            },
          ],
        });
      }

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
        props: {
          className: email.isUnread ? "inbox-block-item--unread" : "",
        },
        children: itemChildren,
      } satisfies ComponentBlock;
    });

    children.push({
      id: `${sid}-email-list`,
      type: "List",
      props: { className: "inbox-block-list" },
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
