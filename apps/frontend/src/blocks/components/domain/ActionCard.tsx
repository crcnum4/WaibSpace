import type { BlockProps } from "../../registry";

interface ActionButton {
  id: string;
  label: string;
  variant: "primary" | "secondary" | "danger";
}

interface ActionCardData {
  title: string;
  context: string;
  draftContent?: string;
  riskClass: "A" | "B" | "C";
  actions: ActionButton[];
  source?: string;
}

const RISK_LABELS: Record<string, string> = {
  A: "Low risk",
  B: "Medium risk",
  C: "High risk",
};

/**
 * Action card where Waib has drafted something and needs user approval.
 * Accent border colour reflects the risk classification.
 */
export function ActionCard({ block, onEvent }: BlockProps) {
  const { title, context, draftContent, riskClass, actions, source } =
    block.props as ActionCardData;

  return (
    <div className={`action-card action-card--risk-${riskClass.toLowerCase()}`}>
      <div className="action-card__header">
        <h3 className="action-card__title">{title}</h3>
        <div className="action-card__badges">
          <span
            className={`action-card__risk-badge action-card__risk-badge--${riskClass.toLowerCase()}`}
          >
            {RISK_LABELS[riskClass] ?? riskClass}
          </span>
          {source && <span className="action-card__source-badge">{source}</span>}
        </div>
      </div>

      <div className="action-card__context">{context}</div>

      {draftContent && (
        <div className="action-card__draft">
          <div className="action-card__draft-label">Draft</div>
          <div className="action-card__draft-content">{draftContent}</div>
        </div>
      )}

      <div className="action-card__actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`action-card__btn action-card__btn--${action.variant}`}
            onClick={() =>
              onEvent?.("action-card-click", {
                actionId: action.id,
                label: action.label,
              })
            }
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
