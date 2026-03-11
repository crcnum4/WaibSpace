import type { BlockProps } from "../../registry";

interface StatusCardData {
  connectorId: string;
  classifierId: string;
  itemsProcessed: number;
  categoryBreakdown?: Record<string, number>;
  timestamp?: number;
}

/**
 * System status card showing triage processing stats.
 * Compact, information-dense layout.
 */
export function StatusCard({ block }: BlockProps) {
  const { connectorId, classifierId, itemsProcessed, categoryBreakdown, timestamp } =
    block.props as StatusCardData;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const categories = categoryBreakdown
    ? Object.entries(categoryBreakdown)
    : [];

  return (
    <div className="status-card">
      <div className="status-card__header">
        <h3 className="status-card__title">Processing Status</h3>
        {formattedTime && (
          <span className="status-card__timestamp">{formattedTime}</span>
        )}
      </div>

      <div className="status-card__stats">
        <div className="status-card__stat">
          <span className="status-card__stat-value">{itemsProcessed}</span>
          <span className="status-card__stat-label">items processed</span>
        </div>
        <div className="status-card__stat">
          <span className="status-card__stat-value">{connectorId}</span>
          <span className="status-card__stat-label">source</span>
        </div>
        <div className="status-card__stat">
          <span className="status-card__stat-value">{classifierId}</span>
          <span className="status-card__stat-label">classifier</span>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="status-card__categories">
          <div className="status-card__categories-label">Categories</div>
          <div className="status-card__category-list">
            {categories.map(([cat, count]) => (
              <div key={cat} className="status-card__category">
                <span className="status-card__category-name">{cat}</span>
                <span className="status-card__category-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
