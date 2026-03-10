import type { BlockProps } from "../../registry";

interface ConnectorStatus {
  name: string;
  status: "active" | "error" | "idle";
  lastPoll?: string;
}

interface MemoryStats {
  shortTerm: number;
  midTerm: number;
  longTerm: number;
}

interface StatusCardData {
  title: string;
  connectors: ConnectorStatus[];
  memoryStats?: MemoryStats;
  uptime?: string;
}

/**
 * System status card showing connector health and memory statistics.
 * Compact, information-dense layout.
 */
export function StatusCard({ block }: BlockProps) {
  const { title, connectors, memoryStats, uptime } =
    block.props as StatusCardData;

  return (
    <div className="status-card">
      <div className="status-card__header">
        <h3 className="status-card__title">{title}</h3>
        {uptime && <span className="status-card__uptime">Up {uptime}</span>}
      </div>

      <div className="status-card__connectors">
        {connectors.map((conn) => (
          <div key={conn.name} className="status-card__connector">
            <span
              className={`status-card__status-dot status-card__status-dot--${conn.status}`}
              aria-label={conn.status}
            />
            <span className="status-card__connector-name">{conn.name}</span>
            {conn.lastPoll && (
              <span className="status-card__last-poll">{conn.lastPoll}</span>
            )}
          </div>
        ))}
      </div>

      {memoryStats && (
        <div className="status-card__memory">
          <div className="status-card__memory-label">Memory</div>
          <div className="status-card__memory-bars">
            <div className="status-card__memory-item">
              <span className="status-card__memory-name">Short</span>
              <div className="status-card__memory-bar">
                <div
                  className="status-card__memory-fill status-card__memory-fill--short"
                  style={{ width: `${Math.min(memoryStats.shortTerm, 100)}%` }}
                />
              </div>
              <span className="status-card__memory-value">
                {memoryStats.shortTerm}%
              </span>
            </div>
            <div className="status-card__memory-item">
              <span className="status-card__memory-name">Mid</span>
              <div className="status-card__memory-bar">
                <div
                  className="status-card__memory-fill status-card__memory-fill--mid"
                  style={{ width: `${Math.min(memoryStats.midTerm, 100)}%` }}
                />
              </div>
              <span className="status-card__memory-value">
                {memoryStats.midTerm}%
              </span>
            </div>
            <div className="status-card__memory-item">
              <span className="status-card__memory-name">Long</span>
              <div className="status-card__memory-bar">
                <div
                  className="status-card__memory-fill status-card__memory-fill--long"
                  style={{ width: `${Math.min(memoryStats.longTerm, 100)}%` }}
                />
              </div>
              <span className="status-card__memory-value">
                {memoryStats.longTerm}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
