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

export function GmailEmailCard({ block }: BlockProps) {
  const {
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

  return (
    <div className={cardClass}>
      <div
        className="gmail-email-card__avatar"
        style={{ backgroundColor: avatarBg }}
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
    </div>
  );
}
