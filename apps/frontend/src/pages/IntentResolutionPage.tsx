import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import type {
  ComposedLayout,
  AgentStatus as AgentStatusType,
} from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { useWebSocket } from "../hooks/useWebSocket";
import { SurfaceRenderer } from "../components/SurfaceRenderer";
import { AgentStatus } from "../components/AgentStatus";

const WS_URL = `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}/ws`;

export default function IntentResolutionPage() {
  const location = useLocation();
  const { send, lastMessage, status } = useWebSocket(WS_URL);
  const [layout, setLayout] = useState<ComposedLayout | null>(null);
  const [agents, setAgents] = useState<AgentStatusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSent, setHasSent] = useState(false);

  // Extract intent from path
  const intentPath = location.pathname.replace(/^\//, "");
  const intentQuery = intentPath.replace(/[-_]/g, " ");

  // Send intent to backend once connected
  useEffect(() => {
    if (status === "connected" && !hasSent) {
      send("user.intent.url", { path: intentPath, raw: location.pathname });
      setLoading(true);
      setError(null);
      setHasSent(true);
    }
  }, [status, hasSent, intentPath, location.pathname, send]);

  // Reset on path change
  useEffect(() => {
    setHasSent(false);
    setLayout(null);
    setLoading(true);
    setError(null);
  }, [intentPath]);

  // Listen for responses
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "surface.update":
        setLayout(lastMessage.payload as ComposedLayout);
        setLoading(false);
        break;
      case "status": {
        const statusPayload = lastMessage.payload as {
          phase: string;
          agents: AgentStatusType[];
        };
        setAgents(statusPayload.agents);
        break;
      }
      case "error": {
        const errorPayload = lastMessage.payload as { message: string };
        setError(errorPayload.message);
        setLoading(false);
        break;
      }
    }
  }, [lastMessage]);

  const handleAction = useCallback(
    (action: SurfaceAction) => {
      send("user.interaction", {
        interaction: "action",
        target: action.id,
        context: action.payload,
        timestamp: Date.now(),
      });
    },
    [send],
  );

  const handleInteraction = useCallback(
    (
      interaction: string,
      target: string,
      surfaceId: string,
      surfaceType: string,
      context?: unknown,
    ) => {
      send("user.interaction", {
        interaction,
        target,
        surfaceId,
        surfaceType,
        context,
        timestamp: Date.now(),
      });
    },
    [send],
  );

  const handleRetry = useCallback(() => {
    setHasSent(false);
    setLayout(null);
    setLoading(true);
    setError(null);
  }, []);

  const hasSurfaces = layout && layout.surfaces.length > 0;

  return (
    <div className="page intent-resolution">
      <div className="intent-header">
        <div className="intent-header-content">
          <span className="intent-label">Resolving:</span>
          <span className="intent-query">{intentQuery}</span>
        </div>
        <div className="intent-status-bar">
          <span
            className={`connection-dot ${status === "connected" ? "connected" : status === "connecting" ? "connecting" : "disconnected"}`}
          />
          <AgentStatus agents={agents} />
        </div>
      </div>

      {loading ? (
        <div className="intent-loading">
          <div className="intent-loading-animation">
            <div className="intent-pulse-ring" />
            <div className="intent-pulse-ring delay-1" />
            <div className="intent-pulse-ring delay-2" />
          </div>
          <p className="intent-loading-title">
            Analyzing your intent...
          </p>
          <p className="intent-loading-detail">
            <span className="intent-loading-path">/{intentPath}</span>
          </p>
          {status === "connected" && (
            <p className="intent-loading-agents">
              Agents working on your request
            </p>
          )}
          {status === "connecting" && (
            <p className="intent-loading-agents">
              Connecting to backend...
            </p>
          )}
        </div>
      ) : error ? (
        <div className="intent-error">
          <p className="intent-error-message">{error}</p>
          <button className="action-btn risk-A" onClick={handleRetry}>
            Retry
          </button>
        </div>
      ) : hasSurfaces ? (
        <div className="intent-results">
          <SurfaceRenderer
            layout={layout}
            onAction={handleAction}
            onInteraction={handleInteraction}
          />
          <div className="intent-provenance">
            <span className="intent-provenance-label">
              Results resolved from intent URL
            </span>
            <span className="intent-provenance-path">/{intentPath}</span>
          </div>
        </div>
      ) : (
        <div className="intent-empty">
          <p>No results found for this intent.</p>
          <button className="action-btn risk-A" onClick={handleRetry}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
