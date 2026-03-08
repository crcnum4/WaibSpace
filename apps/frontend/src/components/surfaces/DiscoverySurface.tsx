import type { SurfaceProps } from "./registry";
import type { DiscoverySurfaceData } from "@waibspace/surfaces";

export function DiscoverySurface({
  spec,
  onAction,
  onInteraction,
}: SurfaceProps) {
  const data = spec.data as DiscoverySurfaceData;

  return (
    <div className="surface discovery-surface">
      <div className="surface-header">
        <h3>{spec.title}</h3>
      </div>
      <div className="discovery-query">
        <span className="discovery-query-label">Query:</span> {data.query}
      </div>
      <ul className="discovery-results">
        {data.results.map((result, idx) => (
          <li key={idx} className="discovery-result">
            <div className="discovery-result-header">
              <span className="discovery-result-rank">#{idx + 1}</span>
              <span className="discovery-result-title">{result.title}</span>
            </div>
            <p className="discovery-result-desc">{result.description}</p>
            <div className="discovery-relevance">
              <span className="discovery-relevance-label">Relevance</span>
              <div className="discovery-relevance-bar">
                <div
                  className="discovery-relevance-fill"
                  style={{ width: `${Math.round(result.relevanceScore * 100)}%` }}
                />
              </div>
              <span className="discovery-relevance-score">
                {Math.round(result.relevanceScore * 100)}%
              </span>
            </div>
            {result.matchReasons.length > 0 && (
              <div className="discovery-tags">
                {result.matchReasons.map((reason, ri) => (
                  <span key={ri} className="discovery-tag">
                    {reason}
                  </span>
                ))}
              </div>
            )}
            <div className="discovery-result-actions">
              {result.url && (
                <button
                  className="action-btn risk-A"
                  onClick={() =>
                    onInteraction("follow-link", `result-${idx}`, {
                      url: result.url,
                    })
                  }
                >
                  Follow Link
                </button>
              )}
              <button
                className="action-btn risk-A"
                onClick={() =>
                  onInteraction("save", `result-${idx}`, {
                    title: result.title,
                  })
                }
              >
                Save
              </button>
              <button
                className="action-btn risk-A"
                onClick={() =>
                  onInteraction("share", `result-${idx}`, {
                    title: result.title,
                    url: result.url,
                  })
                }
              >
                Share
              </button>
              {result.actions?.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onAction(action)}
                  className={`action-btn risk-${action.riskClass}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {data.sources.length > 0 && (
        <div className="discovery-sources">
          <span className="discovery-sources-label">Sources:</span>
          {data.sources.map((src, i) => (
            <span key={i} className="discovery-source">
              {src.agentId}
            </span>
          ))}
        </div>
      )}
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
