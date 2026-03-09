import type { SurfaceProps } from "./registry";
import { ProvenanceBadge } from "../ProvenanceBadge";

interface GenericSection {
  heading: string;
  items: Array<{
    label: string;
    detail?: string;
    metadata?: Record<string, string>;
    timestamp?: string;
    url?: string;
  }>;
}

interface GenericPresentation {
  title?: string;
  summary?: string;
  sections?: GenericSection[];
}

function isStructuredData(data: unknown): data is GenericPresentation {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.sections);
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function GenericSurface({ spec, onAction }: SurfaceProps) {
  const data = spec.data as unknown;
  const structured = isStructuredData(data);

  return (
    <div className="surface generic-surface">
      <div className="surface-header">
        <div className="surface-header-top">
          <h3>{spec.title}</h3>
          <ProvenanceBadge provenance={spec.provenance} />
        </div>
        {(structured ? data.summary : spec.summary) && (
          <p className="surface-summary">
            {structured ? data.summary : spec.summary}
          </p>
        )}
      </div>
      <div className="surface-content">
        {structured ? (
          data.sections!.map((section, si) => (
            <div key={si} className="generic-section">
              <h4 className="generic-section-heading">{section.heading}</h4>
              <div className="generic-items">
                {section.items.map((item, ii) => (
                  <div key={ii} className="generic-item">
                    <div className="generic-item-main">
                      <span className="generic-item-label">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.label}
                          </a>
                        ) : (
                          item.label
                        )}
                      </span>
                      {item.timestamp && (
                        <span className="generic-item-time">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      )}
                    </div>
                    {item.detail && (
                      <p className="generic-item-detail">{item.detail}</p>
                    )}
                    {item.metadata &&
                      Object.keys(item.metadata).length > 0 && (
                        <div className="generic-item-badges">
                          {Object.entries(item.metadata).map(([key, value]) => (
                            <span key={key} className="generic-badge">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
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
