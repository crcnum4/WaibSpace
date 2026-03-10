import { useState } from "react";
import type { BlockProps } from "../../registry";

interface InsightAction {
  description: string;
  count: number;
}

interface InsightCardData {
  title: string;
  actions: InsightAction[];
  expandable?: boolean;
  details?: string[];
}

/**
 * Insight card showing what Waib did autonomously.
 * Optionally expandable to reveal detail items.
 */
export function InsightCard({ block }: BlockProps) {
  const { title, actions, expandable, details } =
    block.props as InsightCardData;

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="insight-card">
      <div className="insight-card__header">
        <span className="insight-card__check" aria-hidden="true">
          &#x2713;
        </span>
        <h3 className="insight-card__title">{title}</h3>
      </div>

      <ul className="insight-card__actions">
        {actions.map((action, idx) => (
          <li key={idx} className="insight-card__action">
            <span className="insight-card__action-desc">
              {action.description}
            </span>
            <span className="insight-card__action-count">{action.count}</span>
          </li>
        ))}
      </ul>

      {expandable && details && details.length > 0 && (
        <div className="insight-card__expandable">
          <button
            type="button"
            className="insight-card__toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Hide details" : "Show details"}
          </button>
          {expanded && (
            <ul className="insight-card__details">
              {details.map((detail, idx) => (
                <li key={idx} className="insight-card__detail">
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
