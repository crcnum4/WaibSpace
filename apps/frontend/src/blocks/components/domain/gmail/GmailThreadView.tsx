import { useState, useCallback } from "react";
import type { BlockProps } from "../../../registry";

interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  date: string;
  body: string;
  snippet: string;
  isUnread: boolean;
}

interface GmailThreadViewProps {
  threadId: string;
  subject: string;
  messageCount: number;
  messages: ThreadMessage[];
}

/**
 * Derive a hue from a string so the same sender always gets the same colour.
 */
function senderHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  // Strip email portion if present: "Alice Smith <alice@x.com>" -> "Alice Smith"
  const clean = name.replace(/<[^>]+>/, "").trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getDisplayName(from: string): string {
  const match = from.match(/^([^<]+)</);
  return match ? match[1].trim() : from;
}

/** Number of messages shown before the thread is collapsed */
const COLLAPSE_THRESHOLD = 3;

export function GmailThreadView({ block, onEvent }: BlockProps) {
  const { threadId, subject, messageCount, messages } =
    block.props as GmailThreadViewProps;

  // Track which individual messages are expanded (show full body)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => {
    // By default expand the last message
    if (messages.length > 0) {
      return new Set([messages[messages.length - 1].id]);
    }
    return new Set();
  });

  // Track whether the collapsed middle section is expanded
  const [showAllMessages, setShowAllMessages] = useState(
    messages.length <= COLLAPSE_THRESHOLD,
  );

  const toggleMessage = useCallback((messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleReply = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const lastMessage = messages[messages.length - 1];
      onEvent?.("reply", {
        threadId,
        emailId: lastMessage?.id,
        subject,
      });
    },
    [onEvent, threadId, messages, subject],
  );

  const handleBack = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEvent?.("back", { threadId });
    },
    [onEvent, threadId],
  );

  // Determine which messages to render
  const shouldCollapse =
    !showAllMessages && messages.length > COLLAPSE_THRESHOLD;
  const visibleMessages = shouldCollapse
    ? [messages[0], ...messages.slice(-2)]
    : messages;
  const collapsedCount = shouldCollapse
    ? messages.length - 3
    : 0;

  return (
    <div
      className="gmail-thread-view"
      role="region"
      aria-label={`Email thread: ${subject}`}
    >
      {/* Header */}
      <div className="gmail-thread-view__header">
        <button
          type="button"
          className="gmail-thread-view__back-btn"
          onClick={handleBack}
          aria-label="Back to inbox"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="gmail-thread-view__header-content">
          <h3 className="gmail-thread-view__subject">{subject}</h3>
          <span className="gmail-thread-view__message-count">
            {messageCount} message{messageCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="gmail-thread-view__messages" role="list">
        {visibleMessages.map((msg, idx) => {
          const isExpanded = expandedMessages.has(msg.id);
          const displayName = getDisplayName(msg.from);
          const initials = getInitials(msg.from);
          const hue = senderHue(msg.from);
          const avatarBg = `hsl(${hue}, 55%, 45%)`;

          // Insert the collapsed section after the first message
          const showCollapseBar =
            shouldCollapse && idx === 0;

          return (
            <div key={msg.id}>
              {showCollapseBar && (
                <button
                  type="button"
                  className="gmail-thread-view__collapsed-bar"
                  onClick={() => setShowAllMessages(true)}
                  aria-label={`Show ${collapsedCount} hidden message${collapsedCount !== 1 ? "s" : ""}`}
                >
                  <span className="gmail-thread-view__collapsed-dots">
                    &#8943;
                  </span>
                  <span className="gmail-thread-view__collapsed-text">
                    {collapsedCount} earlier message
                    {collapsedCount !== 1 ? "s" : ""}
                  </span>
                </button>
              )}
              <div
                className={[
                  "gmail-thread-view__message",
                  isExpanded ? "gmail-thread-view__message--expanded" : "",
                  msg.isUnread ? "gmail-thread-view__message--unread" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="listitem"
              >
                <button
                  type="button"
                  className="gmail-thread-view__message-header"
                  onClick={() => toggleMessage(msg.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} message from ${displayName}`}
                >
                  <div
                    className="gmail-thread-view__avatar"
                    style={{ backgroundColor: avatarBg }}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div className="gmail-thread-view__message-meta">
                    <span className="gmail-thread-view__sender">
                      {displayName}
                    </span>
                    <span className="gmail-thread-view__date">{msg.date}</span>
                  </div>
                  <svg
                    className={`gmail-thread-view__chevron${isExpanded ? " gmail-thread-view__chevron--open" : ""}`}
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 5.5L7 8.5l3-3"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {!isExpanded && (
                  <p className="gmail-thread-view__snippet">{msg.snippet}</p>
                )}

                {isExpanded && (
                  <div className="gmail-thread-view__body">
                    <div className="gmail-thread-view__body-meta">
                      <span>
                        To: {msg.to}
                      </span>
                    </div>
                    <div className="gmail-thread-view__body-text">
                      {msg.body}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="gmail-thread-view__footer">
        <button
          type="button"
          className="gmail-thread-view__reply-btn"
          onClick={handleReply}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6.5 4L2.5 8l4 4M2.5 8h7a4 4 0 014 4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Reply
        </button>
      </div>
    </div>
  );
}
