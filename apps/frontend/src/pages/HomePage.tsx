import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import type {
  ComposedLayout,
  AgentStatus as AgentStatusType,
} from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { useWebSocket } from "../hooks/useWebSocket";
import { BlockSurfaceRenderer } from "../components/BlockSurfaceRenderer";
import { AgentStatus } from "../components/AgentStatus";
import { ChatInput } from "../components/ChatInput";
import { WelcomeState } from "../components/WelcomeState";
import { ErrorSurface } from "../components/ErrorSurface";
import { BlockInspector, BlockInspectorToggle } from "../blocks/BlockInspector";
import { composedLayoutToBlocks } from "../blocks/transformers";

const WS_URL = `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}/ws`;
const API_BASE = `http://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}`;

interface ConnectedService {
  id: string;
  name: string;
}

export default function HomePage() {
  const { send, lastMessage, status } = useWebSocket(WS_URL);
  const location = useLocation();
  const [layout, setLayout] = useState<ComposedLayout | null>(null);
  const [agents, setAgents] = useState<AgentStatusType[]>([]);
  const [hasCheckedConnections, setHasCheckedConnections] = useState(false);
  const [connectedServices, setConnectedServices] = useState<ConnectedService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pipelinePhase, setPipelinePhase] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [observations, setObservations] = useState<
    Array<{ type: string; payload: unknown; time: string }>
  >([]);

  // Derive block tree for the inspector
  const inspectorBlocks = useMemo(() => {
    if (!layout || layout.surfaces.length === 0) return [];
    return composedLayoutToBlocks(layout);
  }, [layout]);

  // On initial connection, check what services are connected
  // Show WelcomeState immediately, then trigger data fetch in background
  useEffect(() => {
    if (status !== "connected" || hasCheckedConnections) return;
    setHasCheckedConnections(true);

    fetch(`${API_BASE}/api/mcp/servers`)
      .then((res) => res.json())
      .then((servers: Array<{ config: { id: string; name: string }; connected: boolean }>) => {
        const connected = servers
          .filter((s) => s.connected)
          .map((s) => ({ id: s.config.id, name: s.config.name }));

        setConnectedServices(connected);

        if (connected.length === 0) return; // Stay on WelcomeState

        // Build a targeted request for connected services only
        const parts: string[] = [];
        for (const svc of connected) {
          const lower = svc.name.toLowerCase();
          if (lower.includes("gmail") || lower.includes("mail") || lower.includes("email")) {
            parts.push("my latest emails");
          } else if (lower.includes("calendar")) {
            parts.push("my upcoming calendar events");
          } else if (lower.includes("github")) {
            parts.push("my recent GitHub activity");
          } else if (lower.includes("slack")) {
            parts.push("my recent Slack messages");
          } else {
            parts.push(`my latest data from ${svc.name}`);
          }
        }

        setIsLoading(true);
        send("user.message", { text: `Show me ${parts.join(" and ")}` });
      })
      .catch(() => {
        // API unavailable — stay on WelcomeState
      });
  }, [status, hasCheckedConnections, send]);

  // Handle messages from the global input bar
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail as string;
      if (text && status === "connected") {
        send("user.message", { text });
        setIsLoading(true);
      }
    };
    window.addEventListener("waibspace:global-message", handler);
    return () => window.removeEventListener("waibspace:global-message", handler);
  }, [send, status]);

  // Handle pending message from navigation (global bar on other pages)
  useEffect(() => {
    const state = location.state as { pendingMessage?: string } | null;
    if (state?.pendingMessage && status === "connected") {
      send("user.message", { text: state.pendingMessage });
      setIsLoading(true);
      window.history.replaceState({}, "");
    }
  }, [location.state, status, send]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "surface.update": {
        const newLayout = lastMessage.payload as ComposedLayout;
        if (newLayout.surfaces.length > 0) {
          setLayout(newLayout);
          setIsLoading(false);
          setPipelinePhase(null);
          setErrorMessage(null);
        }
        break;
      }
      case "status": {
        const statusPayload = lastMessage.payload as {
          phase: string;
          agents: AgentStatusType[];
        };
        setAgents(statusPayload.agents);
        setPipelinePhase(statusPayload.phase);
        break;
      }
      case "error": {
        const errorPayload = lastMessage.payload as {
          message: string;
          code: string;
        };
        setErrorMessage(errorPayload.message);
        setIsLoading(false);
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
      if (
        surfaceType === "approval" &&
        (interaction === "approve" || interaction === "deny")
      ) {
        send("approval.response", {
          approvalId: target,
          approved: interaction === "approve",
        });
        return;
      }

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

  const handleSend = useCallback(
    (text: string) => {
      send("user.message", { text });
      setIsLoading(true);
    },
    [send],
  );

  const hasSurfaces = layout && layout.surfaces.length > 0;

  return (
    <div className="page home-page">
      {status !== "connected" && (
        <div className={`connection-banner ${status}`}>
          <span className="connection-banner-icon">!</span>
          {status === "connecting"
            ? "Reconnecting to server..."
            : "Connection lost. Attempting to reconnect..."}
        </div>
      )}

      <div className="home-status-bar">
        <span
          className={`connection-dot ${status === "connected" ? "connected" : status === "connecting" ? "connecting" : "disconnected"}`}
        />
        <span className="connection-label">
          {status === "connected"
            ? "Connected"
            : status === "connecting"
              ? "Connecting..."
              : "Disconnected"}
        </span>
        <AgentStatus agents={agents} />
      </div>

      <div className="home-content">
        {errorMessage && (
          <ErrorSurface
            errors={[
              {
                agentId: "system",
                message: errorMessage,
                phase: "orchestration",
              },
            ]}
          />
        )}
        {hasSurfaces || isLoading ? (
          <BlockSurfaceRenderer
            layout={layout}
            onAction={handleAction}
            onInteraction={handleInteraction}
            isLoading={isLoading}
            pipelinePhase={pipelinePhase}
            loadingServices={isLoading && !hasSurfaces ? connectedServices : undefined}
          />
        ) : (
          <WelcomeState onSuggest={handleSend} />
        )}
      </div>

      <div className="home-chat">
        <ChatInput onSend={handleSend} placeholder="Ask WaibSpace anything..." />
      </div>

      <BlockInspectorToggle onClick={() => setInspectorOpen((o) => !o)} />
      <BlockInspector
        blocks={inspectorBlocks}
        observations={observations}
        isOpen={inspectorOpen}
        onToggle={() => setInspectorOpen((o) => !o)}
      />
    </div>
  );
}
