import { useCallback } from "react";
import type { BlockProps } from "../../../registry";

interface GmailEmailCardProps {
  emailId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  labels?: string[];
  urgency?: "high" | "medium" | "low";
  suggestedReply?: string;
}

/**
 * Derive a hue from a string using a simple hash so the same sender
 * always gets the same avatar colour.
 */
function senderHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function GmailEmailCard({ block, onEvent }: BlockProps) {
  const {
    emailId,
    from,
    subject,
    snippet,
    date,
    isUnread,
    labels = [],
    urgency,
  } = block.props as GmailEmailCardProps;

  const initials = getInitials(from);
  const hue = senderHue(from);
  const avatarBg = `hsl(${hue}, 55%, 45%)`;

  const hasImportant = labels.includes("IMPORTANT");
  const hasStarred = labels.includes("STARRED");

  const cardClass = [
    "gmail-email-card",
    isUnread ? "gmail-email-card--unread" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleQuickAction = useCallback(
    (action: "archive" | "reply" | "snooze", e: React.MouseEvent) => {
      e.stopPropagation();
      onEvent?.(action, { emailId, from, subject });
    },
    [onEvent, emailId, from, subject],
  );

  return (
    <div className={cardClass} role="listitem" aria-label={`${isUnread ? "Unread: " : ""}${subject || "No Subject"} from ${from}`}>
      <div
        className="gmail-email-card__avatar"
        style={{ backgroundColor: avatarBg }}
        aria-hidden="true"
      >
        {initials}
      </div>

      <div className="gmail-email-card__content">
        <div className="gmail-email-card__subject">{subject || "No Subject"}</div>
        <div className="gmail-email-card__meta">
          <span className="gmail-email-card__from">{from}</span>
          <span className="gmail-email-card__date">{date}</span>
        </div>
        <div className="gmail-email-card__snippet">{snippet}</div>
      </div>

      <div className="gmail-email-card__actions">
        {urgency && (
          <span
            className={`gmail-email-card__urgency gmail-email-card__urgency--${urgency}`}
          >
            {urgency}
          </span>
        )}
        {(hasImportant || hasStarred) && (
          <span className="gmail-email-card__star">
            {hasStarred ? "\u2605" : "\u2606"}
          </span>
        )}
      </div>

      <div className="gmail-email-card__quick-actions" aria-label="Quick actions">
        <button
          type="button"
          className="gmail-email-card__quick-btn"
          title="Archive"
          aria-label="Archive email"
          onClick={(e) => handleQuickAction("archive", e)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M1.5 4.5h13M2.5 4.5v8a1 1 0 001 1h9a1 1 0 001-1v-8M5.5 7.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M0.5 2.5h15v2h-15z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          type="button"
          className="gmail-email-card__quick-btn"
          title="Reply"
          aria-label="Reply to email"
          onClick={(e) => handleQuickAction("reply", e)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6.5 4L2.5 8l4 4M2.5 8h7a4 4 0 014 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          type="button"
          className="gmail-email-card__quick-btn"
          title="Snooze"
          aria-label="Snooze email"
          onClick={(e) => handleQuickAction("snooze", e)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 5.5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.5 1.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
