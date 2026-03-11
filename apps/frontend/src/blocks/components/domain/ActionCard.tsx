import type { BlockProps } from "../../registry";

interface ActionCardData {
  itemId: string;
  from: string;
  subject: string;
  snippet?: string;
  category: string;
  urgency?: string;
  reasoning?: string;
  suggestedAction?: string;
  confidence?: number;
  actions?: string[];
}

const ACTION_LABELS: Record<string, string> = {
  approve: "Approve",
  edit: "Edit",
  dismiss: "Dismiss",
  reply: "Reply",
  archive: "Archive",
};

const ACTION_VARIANTS: Record<string, string> = {
  approve: "primary",
  edit: "secondary",
  dismiss: "danger",
  reply: "primary",
  archive: "secondary",
};

/**
 * Action card for high-urgency triaged items that need user attention.
 * Shows sender, subject, reasoning, and action buttons.
 */
export function ActionCard({ block, onEvent }: BlockProps) {
  const {
    itemId,
    from,
    subject,
    snippet,
    category,
    urgency,
    reasoning,
    suggestedAction,
    confidence,
    actions,
  } = block.props as ActionCardData;

  const actionList = actions ?? ["approve", "dismiss"];
  const urgencyClass = urgency === "high" ? "urgent" : "review";

  return (
    <div className={`action-card action-card--${urgencyClass}`}>
      <div className="action-card__header">
        <h3 className="action-card__title">{subject || "No subject"}</h3>
        <div className="action-card__badges">
          <span className="action-card__category-badge">{category}</span>
          {confidence != null && (
            <span className="action-card__confidence">
              {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
      </div>

      <div className="action-card__sender">From: {from || "Unknown"}</div>

      {snippet && <div className="action-card__snippet">{snippet}</div>}

      {reasoning && (
        <div className="action-card__reasoning">
          <span className="action-card__reasoning-label">Why:</span> {reasoning}
        </div>
      )}

      {suggestedAction && (
        <div className="action-card__suggestion">
          Suggested: {suggestedAction}
        </div>
      )}

      <div className="action-card__actions">
        {actionList.map((action) => (
          <button
            key={action}
            type="button"
            className={`action-card__btn action-card__btn--${ACTION_VARIANTS[action] ?? "secondary"}`}
            onClick={() =>
              onEvent?.("action-card-click", {
                actionId: action,
                itemId,
              })
            }
          >
            {ACTION_LABELS[action] ?? action}
          </button>
        ))}
      </div>
    </div>
  );
}
