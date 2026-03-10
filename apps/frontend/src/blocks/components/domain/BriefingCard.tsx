import type { BlockProps } from "../../registry";

interface BriefingItem {
  label: string;
  detail?: string;
  urgency: "high" | "medium" | "low";
  actionId?: string;
}

interface BriefingCardData {
  title: string;
  items: BriefingItem[];
  summary?: string;
  timestamp?: number;
}

/**
 * Briefing card summarising what needs the user's attention.
 * Renders a list of items with urgency indicators.
 */
export function BriefingCard({ block, onEvent }: BlockProps) {
  const { title, items, summary, timestamp } = block.props as BriefingCardData;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="briefing-card">
      <div className="briefing-card__header">
        <h3 className="briefing-card__title">{title}</h3>
        {formattedTime && (
          <span className="briefing-card__timestamp">{formattedTime}</span>
        )}
      </div>

      <ul className="briefing-card__items">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`briefing-card__item${item.actionId ? " briefing-card__item--actionable" : ""}`}
            role={item.actionId ? "button" : undefined}
            tabIndex={item.actionId ? 0 : undefined}
            onClick={
              item.actionId
                ? () => onEvent?.("briefing-action", { actionId: item.actionId })
                : undefined
            }
            onKeyDown={
              item.actionId
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onEvent?.("briefing-action", { actionId: item.actionId });
                    }
                  }
                : undefined
            }
          >
            <span
              className={`briefing-card__urgency-dot briefing-card__urgency-dot--${item.urgency}`}
              aria-label={`${item.urgency} urgency`}
            />
            <div className="briefing-card__item-content">
              <span className="briefing-card__item-label">{item.label}</span>
              {item.detail && (
                <span className="briefing-card__item-detail">{item.detail}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {summary && <p className="briefing-card__summary">{summary}</p>}
    </div>
  );
}
