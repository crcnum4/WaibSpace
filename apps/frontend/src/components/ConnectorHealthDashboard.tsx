import { useState, useEffect, useCallback, useRef } from "react";

/** A single health-check entry from the backend. */
interface HealthCheckEntry {
  timestamp: number;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/** Aggregated health metrics for a single MCP connector. */
interface ConnectorHealthMetrics {
  serverId: string;
  serverName: string;
  transport: string;
  connected: boolean;
  lastChecked: string | null;
  connectedSince: string | null;
  uptimePercent: number;
  latencyMs: number | null;
  avgLatencyMs: number | null;
  errorCount: number;
  recentErrors: Array<{ timestamp: string; message: string }>;
  checkHistory: HealthCheckEntry[];
}

const POLL_INTERVAL = 15_000;

export function ConnectorHealthDashboard() {
  const [metrics, setMetrics] = useState<ConnectorHealthMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/health");
      if (res.ok) {
        const data: ConnectorHealthMetrics[] = await res.json();
        setMetrics(data);
      }
    } catch {
      // silent polling failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    pollRef.current = setInterval(fetchMetrics, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMetrics]);

  const triggerHealthCheck = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/mcp/health/check", { method: "POST" });
      if (res.ok) {
        const data: ConnectorHealthMetrics[] = await res.json();
        setMetrics(data);
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const toggleErrors = (serverId: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="health-dashboard__loading">
        <span className="health-dashboard__loading-dot" />
        Loading health metrics...
      </div>
    );
  }

  return (
    <div className="health-dashboard">
      <div className="health-dashboard__header">
        <h3 className="health-dashboard__title">Connector Health</h3>
        <button
          className={`health-dashboard__refresh-btn ${refreshing ? "health-dashboard__refresh-btn--spinning" : ""}`}
          onClick={triggerHealthCheck}
          disabled={refreshing}
        >
          <span className="health-dashboard__refresh-icon" aria-hidden="true">
            &#x21bb;
          </span>
          {refreshing ? "Checking..." : "Run Health Check"}
        </button>
      </div>

      {metrics.length === 0 && (
        <div className="health-dashboard__empty">
          No connectors configured. Add an MCP server to see health metrics.
        </div>
      )}

      {metrics.map((m) => (
        <HealthCard
          key={m.serverId}
          metrics={m}
          errorsExpanded={expandedErrors.has(m.serverId)}
          onToggleErrors={() => toggleErrors(m.serverId)}
        />
      ))}
    </div>
  );
}

// ---- Sub-components ----

function HealthCard({
  metrics,
  errorsExpanded,
  onToggleErrors,
}: {
  metrics: ConnectorHealthMetrics;
  errorsExpanded: boolean;
  onToggleErrors: () => void;
}) {
  const statusClass = metrics.connected
    ? "connected"
    : metrics.errorCount > 0
      ? "error"
      : "disconnected";

  return (
    <div className="health-card">
      <div className="health-card__header">
        <span className={`health-card__status-dot health-card__status-dot--${statusClass}`} />
        <span className="health-card__name">{metrics.serverName}</span>
        <span className="health-card__transport-badge">{metrics.transport}</span>
      </div>

      <div className="health-card__metrics">
        <div className="health-metric">
          <span className="health-metric__label">Status</span>
          <span className={`health-metric__value ${metrics.connected ? "health-metric__value--good" : "health-metric__value--bad"}`}>
            {metrics.connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="health-metric">
          <span className="health-metric__label">Uptime</span>
          <span className={`health-metric__value ${uptimeClass(metrics.uptimePercent)}`}>
            {metrics.checkHistory.length > 0 ? `${metrics.uptimePercent}%` : "--"}
          </span>
        </div>

        <div className="health-metric">
          <span className="health-metric__label">Latency</span>
          <span className={`health-metric__value ${latencyClass(metrics.latencyMs)}`}>
            {metrics.latencyMs != null ? `${metrics.latencyMs}ms` : "--"}
          </span>
        </div>

        <div className="health-metric">
          <span className="health-metric__label">Avg Latency</span>
          <span className={`health-metric__value ${latencyClass(metrics.avgLatencyMs)}`}>
            {metrics.avgLatencyMs != null ? `${metrics.avgLatencyMs}ms` : "--"}
          </span>
        </div>

        <div className="health-metric">
          <span className="health-metric__label">Errors</span>
          <span className={`health-metric__value ${metrics.errorCount > 0 ? "health-metric__value--bad" : "health-metric__value--muted"}`}>
            {metrics.errorCount}
          </span>
        </div>

        <div className="health-metric">
          <span className="health-metric__label">Last Checked</span>
          <span className="health-metric__value health-metric__value--muted">
            {metrics.lastChecked ? formatRelativeTime(metrics.lastChecked) : "--"}
          </span>
        </div>
      </div>

      {metrics.checkHistory.length > 0 && (
        <div className="health-card__latency-section">
          <div className="health-card__section-label">Recent Latency</div>
          <LatencyChart history={metrics.checkHistory} />
        </div>
      )}

      {metrics.errorCount > 0 && (
        <div className="health-card__errors">
          <button className="health-card__error-toggle" onClick={onToggleErrors}>
            {errorsExpanded ? "Hide" : "Show"} error history ({metrics.recentErrors.length})
          </button>
          {errorsExpanded && (
            <ul className="health-card__error-list">
              {metrics.recentErrors.map((err, i) => (
                <li key={i} className="health-card__error-item">
                  <span className="health-card__error-time">
                    {formatRelativeTime(err.timestamp)}
                  </span>
                  <span className="health-card__error-msg" title={err.message}>
                    {err.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {metrics.connectedSince && (
        <div className="health-card__connected-since">
          Connected since {formatAbsoluteTime(metrics.connectedSince)}
        </div>
      )}
    </div>
  );
}

function LatencyChart({ history }: { history: HealthCheckEntry[] }) {
  // Show the most recent 20 entries, oldest to newest (left to right)
  const entries = history.slice(0, 20).reverse();
  const maxLatency = Math.max(
    ...entries.filter((e) => e.ok && e.latencyMs != null).map((e) => e.latencyMs!),
    1,
  );

  return (
    <div className="health-latency-chart">
      {entries.map((entry, i) => {
        if (!entry.ok) {
          return (
            <div
              key={i}
              className="health-latency-chart__bar health-latency-chart__bar--error"
              style={{ height: "100%" }}
              title={`Error: ${entry.error ?? "unknown"}`}
            />
          );
        }
        const latency = entry.latencyMs ?? 0;
        const heightPct = Math.max((latency / maxLatency) * 100, 8);
        const barClass =
          latency < 200
            ? "health-latency-chart__bar--good"
            : latency < 1000
              ? "health-latency-chart__bar--warn"
              : "health-latency-chart__bar--bad";

        return (
          <div
            key={i}
            className={`health-latency-chart__bar ${barClass}`}
            style={{ height: `${heightPct}%` }}
            title={`${latency}ms`}
          />
        );
      })}
    </div>
  );
}

// ---- Helpers ----

function uptimeClass(pct: number): string {
  if (pct >= 95) return "health-metric__value--good";
  if (pct >= 70) return "health-metric__value--warn";
  return "health-metric__value--bad";
}

function latencyClass(ms: number | null): string {
  if (ms == null) return "health-metric__value--muted";
  if (ms < 200) return "health-metric__value--good";
  if (ms < 1000) return "health-metric__value--warn";
  return "health-metric__value--bad";
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
