import { useState } from "react";
import type { BlockProps } from "../../registry";

interface MemorySummary {
  domain: string;
  summary: string;
}

interface InsightCardData {
  title: string;
  autoActionCount?: number;
  actionBreakdown?: Record<string, number>;
  memoryCandidateCount?: number;
  memorySummaries?: MemorySummary[];
}

/**
 * Insight card showing what Waib did autonomously.
 * Displays auto-action breakdown and memory candidates.
 */
export function InsightCard({ block }: BlockProps) {
  const {
    title,
    autoActionCount,
    actionBreakdown,
    memoryCandidateCount,
    memorySummaries,
  } = block.props as InsightCardData;

  const [expanded, setExpanded] = useState(false);

  const breakdownEntries = actionBreakdown
    ? Object.entries(actionBreakdown)
    : [];
  const hasDetails =
    (memorySummaries && memorySummaries.length > 0) || breakdownEntries.length > 0;

  return (
    <div className="insight-card">
      <div className="insight-card__header">
        <span className="insight-card__check" aria-hidden="true">
          &#x2713;
        </span>
        <h3 className="insight-card__title">{title}</h3>
        {autoActionCount != null && autoActionCount > 0 && (
          <span className="insight-card__count">{autoActionCount} actions</span>
        )}
      </div>

      {breakdownEntries.length > 0 && (
        <ul className="insight-card__actions">
          {breakdownEntries.map(([type, count]) => (
            <li key={type} className="insight-card__action">
              <span className="insight-card__action-desc">{type}</span>
              <span className="insight-card__action-count">{count}</span>
            </li>
          ))}
        </ul>
      )}

      {hasDetails && memorySummaries && memorySummaries.length > 0 && (
        <div className="insight-card__expandable">
          <button
            type="button"
            className="insight-card__toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded
              ? "Hide memory updates"
              : `Show ${memoryCandidateCount ?? memorySummaries.length} memory update${(memoryCandidateCount ?? memorySummaries.length) !== 1 ? "s" : ""}`}
          </button>
          {expanded && (
            <ul className="insight-card__details">
              {memorySummaries.map((ms, idx) => (
                <li key={idx} className="insight-card__detail">
                  <span className="insight-card__detail-domain">
                    {ms.domain}
                  </span>
                  <span className="insight-card__detail-summary">
                    {ms.summary}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
