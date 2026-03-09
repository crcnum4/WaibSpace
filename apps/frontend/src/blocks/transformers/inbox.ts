import type {
  ComponentBlock,
  SurfaceSpec,
  SurfaceAction,
  EmitAction,
} from "@waibspace/types";
import type { InboxSurfaceData } from "@waibspace/surfaces";

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

  // Error banner when data retrieval failed
  if (data.error) {
    children.push({
      id: `${sid}-error`,
      type: "Text",
      props: {
        text: data.error,
        variant: "error",
      },
    });
  }

  // Email cards
  if (data.emails && data.emails.length > 0) {
    for (let i = 0; i < data.emails.length; i++) {
      const email = data.emails[i];
      const cardProps: Record<string, unknown> = {
        emailId: email.id,
        from: email.from,
        subject: email.subject,
        snippet: email.snippet,
        date: formatRelativeTime(email.date),
        isUnread: email.isUnread,
      };
      // urgency may be absent if the LLM-strip PR lands
      if ("urgency" in email && email.urgency) {
        cardProps.urgency = email.urgency;
      }
      children.push({
        id: `${sid}-email-${i}`,
        type: "GmailEmailCard",
        props: cardProps,
      });
    }
  }

  // Actions row
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
      type: "GmailInboxList",
      props: {
        unreadCount: data.unreadCount,
        totalCount: data.totalCount,
        isScanned: false,
        ...(data.error ? { error: data.error } : {}),
      },
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
