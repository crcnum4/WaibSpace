import type { BlockProps } from "../../registry";

interface BriefingCardData {
  title: string;
  summary?: string;
  timestamp?: number;
  // Stats from LayoutComposer triage briefing
  urgentCount?: number;
  mediumCount?: number;
  lowCount?: number;
  handledCount?: number;
  // Away summary fields
  eventCount?: number;
  eventBreakdown?: Record<string, number>;
  eventSummaries?: string[];
  durationFormatted?: string;
}

/**
 * Briefing card summarising what needs the user's attention.
 * Renders triage stats or away-summary data from the LayoutComposer.
 */
export function BriefingCard({ block }: BlockProps) {
  const {
    title,
    summary,
    timestamp,
    urgentCount,
    mediumCount,
    lowCount,
    handledCount,
    eventCount,
    eventBreakdown,
    eventSummaries,
    durationFormatted,
  } = block.props as BriefingCardData;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const hasTriageStats =
    urgentCount != null || mediumCount != null || lowCount != null;
  const hasAwayData = eventCount != null || eventSummaries != null;

  return (
    <div className="briefing-card">
      <div className="briefing-card__header">
        <h3 className="briefing-card__title">{title}</h3>
        {formattedTime && (
          <span className="briefing-card__timestamp">{formattedTime}</span>
        )}
      </div>

      {summary && <p className="briefing-card__summary">{summary}</p>}

      {hasTriageStats && (
        <div className="briefing-card__stats">
          {urgentCount != null && urgentCount > 0 && (
            <div className="briefing-card__stat briefing-card__stat--urgent">
              <span className="briefing-card__stat-count">{urgentCount}</span>
              <span className="briefing-card__stat-label">urgent</span>
            </div>
          )}
          {mediumCount != null && mediumCount > 0 && (
            <div className="briefing-card__stat briefing-card__stat--medium">
              <span className="briefing-card__stat-count">{mediumCount}</span>
              <span className="briefing-card__stat-label">needs review</span>
            </div>
          )}
          {lowCount != null && lowCount > 0 && (
            <div className="briefing-card__stat briefing-card__stat--low">
              <span className="briefing-card__stat-count">{lowCount}</span>
              <span className="briefing-card__stat-label">low priority</span>
            </div>
          )}
          {handledCount != null && handledCount > 0 && (
            <div className="briefing-card__stat briefing-card__stat--handled">
              <span className="briefing-card__stat-count">{handledCount}</span>
              <span className="briefing-card__stat-label">auto-handled</span>
            </div>
          )}
        </div>
      )}

      {hasAwayData && (
        <div className="briefing-card__away">
          {durationFormatted && (
            <p className="briefing-card__away-duration">
              Away for {durationFormatted}
            </p>
          )}
          {eventBreakdown && Object.keys(eventBreakdown).length > 0 && (
            <div className="briefing-card__away-breakdown">
              {Object.entries(eventBreakdown).map(([type, count]) => (
                <span key={type} className="briefing-card__away-type">
                  {count} {type.replace(/\./g, " ")}
                </span>
              ))}
            </div>
          )}
          {eventSummaries && eventSummaries.length > 0 && (
            <ul className="briefing-card__away-events">
              {eventSummaries.map((s, i) => (
                <li key={i} className="briefing-card__away-event">{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
