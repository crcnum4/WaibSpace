import { useState } from "react";
import type { SurfaceProps } from "./registry";
import type { InboxSurfaceData } from "@waibspace/surfaces";

export function InboxSurface({ spec, onAction, onInteraction }: SurfaceProps) {
  const data = spec.data as InboxSurfaceData;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const handleEmailClick = (emailId: string) => {
    onInteraction("click", emailId);
    setExpandedId(expandedId === emailId ? null : emailId);
  };

  const handleSwipe = (emailId: string, direction: string) => {
    onInteraction("swipe", emailId, { direction });
  };

  const formatTime = (date: string) => {
    try {
      const d = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      if (diffHrs < 1) return `${Math.round(diffHrs * 60)}m ago`;
      if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return date;
    }
  };

  return (
    <div className="surface inbox-surface">
      <div className="surface-header">
        <h3>{spec.title}</h3>
        <span className="inbox-counts">
          {data.unreadCount} unread of {data.totalCount}
        </span>
      </div>
      <ul className="inbox-list">
        {data.emails.map((email) => (
          <li
            key={email.id}
            className={`inbox-item ${email.isUnread ? "unread" : ""} urgency-${email.urgency}`}
            onClick={() => handleEmailClick(email.id)}
            onPointerDown={(e) => {
              const startX = e.clientX;
              const onUp = (upEvt: PointerEvent) => {
                const dx = upEvt.clientX - startX;
                if (Math.abs(dx) > 80) {
                  handleSwipe(email.id, dx > 0 ? "right" : "left");
                }
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointerup", onUp);
            }}
          >
            <div className="inbox-item-row">
              {email.isUnread && <span className="unread-dot" />}
              <div className="inbox-item-content">
                <div className="inbox-item-top">
                  <span className="inbox-sender">{email.from}</span>
                  <span className="inbox-time">{formatTime(email.date)}</span>
                </div>
                <div className="inbox-subject">{email.subject}</div>
                <div className="inbox-snippet">{email.snippet}</div>
              </div>
              <span className={`urgency-badge urgency-${email.urgency}`}>
                {email.urgency}
              </span>
            </div>

            {expandedId === email.id && (
              <div className="inbox-expanded">
                {email.suggestedReply && (
                  <div className="inbox-suggested-reply">
                    <label>Suggested Reply</label>
                    <textarea
                      value={
                        replyTexts[email.id] ?? email.suggestedReply
                      }
                      onChange={(e) =>
                        setReplyTexts((prev) => ({
                          ...prev,
                          [email.id]: e.target.value,
                        }))
                      }
                      onClick={(e) => e.stopPropagation()}
                      rows={3}
                    />
                  </div>
                )}
                <div className="inbox-actions">
                  <button
                    className="action-btn risk-A"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteraction("reply", email.id, {
                        text: replyTexts[email.id] ?? email.suggestedReply,
                      });
                    }}
                  >
                    Reply
                  </button>
                  <button
                    className="action-btn risk-A"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteraction("archive", email.id);
                    }}
                  >
                    Archive
                  </button>
                  <button
                    className="action-btn risk-B"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteraction("snooze", email.id);
                    }}
                  >
                    Snooze
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {spec.actions.length > 0 && (
        <div className="surface-actions">
          {spec.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action)}
              className={`action-btn risk-${action.riskClass}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
