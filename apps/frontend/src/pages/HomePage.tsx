import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import type {
  ComposedLayout,
  AgentStatus as AgentStatusType,
} from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { useWebSocket } from "../hooks/useWebSocket";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { BlockSurfaceRenderer } from "../components/BlockSurfaceRenderer";
import { AgentStatus } from "../components/AgentStatus";
import { ChatInput } from "../components/ChatInput";
import { WelcomeState } from "../components/WelcomeState";
import { ErrorSurface } from "../components/ErrorSurface";
import { KeyboardShortcutHelp } from "../components/KeyboardShortcutHelp";
import { BlockInspector, BlockInspectorToggle } from "../blocks/BlockInspector";
import { composedLayoutToBlocks } from "../blocks/transformers";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationStack } from "../components/NotificationToast";

const WS_URL = `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}/ws`;
const API_BASE = `http://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}`;

interface ConnectedService {
  id: string;
  name: string;
}

interface FailedService {
  id: string;
  name: string;
  error: string;
}

export default function HomePage() {
  const { send, lastMessage, status, pendingCount } = useWebSocket(WS_URL);
  const location = useLocation();
  const [layout, setLayout] = useState<ComposedLayout | null>(null);
  const [agents, setAgents] = useState<AgentStatusType[]>([]);
  const [hasCheckedConnections, setHasCheckedConnections] = useState(false);
  const [connectedServices, setConnectedServices] = useState<ConnectedService[]>([]);
  const [failedServices, setFailedServices] = useState<FailedService[]>([]);
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

  // Keyboard navigation for email lists
  const hasSurfaces = layout && layout.surfaces.length > 0;

  const handleEmailSelect = useCallback(
    (_index: number, element: HTMLElement) => {
      // Simulate a click on the selected card
      element.click();
    },
    [],
  );

  const handleEmailArchive = useCallback(
    (_index: number, _element: HTMLElement) => {
      send("user.interaction", {
        interaction: "archive",
        target: "keyboard-shortcut",
        surfaceId: "gmail-inbox",
        surfaceType: "gmail",
        context: { source: "keyboard" },
        timestamp: Date.now(),
      });
    },
    [send],
  );

  const handleEmailReply = useCallback(
    (_index: number, _element: HTMLElement) => {
      send("user.interaction", {
        interaction: "reply",
        target: "keyboard-shortcut",
        surfaceId: "gmail-inbox",
        surfaceType: "gmail",
        context: { source: "keyboard" },
        timestamp: Date.now(),
      });
    },
    [send],
  );

  useKeyboardNavigation({
    containerSelector: ".gmail-inbox-list__cards",
    itemSelector: ".gmail-email-card",
    onSelect: handleEmailSelect,
    onArchive: handleEmailArchive,
    onReply: handleEmailReply,
    enabled: !!hasSurfaces,
  });

  const { helpVisible, dismissHelp } = useGlobalShortcuts();
  const { notifications, dismiss: dismissNotification } = useNotifications(lastMessage);

  // On initial connection, check what services are connected
  // Show WelcomeState immediately, then trigger data fetch in background
  useEffect(() => {
    if (status !== "connected" || hasCheckedConnections) return;
    setHasCheckedConnections(true);

    fetch(`${API_BASE}/api/mcp/servers`)
      .then((res) => res.json())
      .then((servers: Array<{ config: { id: string; name: string }; connected: boolean; error: string | null }>) => {
        const connected = servers
          .filter((s) => s.connected)
          .map((s) => ({ id: s.config.id, name: s.config.name }));

        const failed = servers
          .filter((s) => !s.connected && s.error)
          .map((s) => ({ id: s.config.id, name: s.config.name, error: s.error! }));

        setConnectedServices(connected);
        setFailedServices(failed);

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

  return (
    <div className="page home-page">
      <NotificationStack notifications={notifications} onDismiss={dismissNotification} />
      {status !== "connected" && (
        <div className={`connection-banner ${status === "reconnecting" ? "connecting" : status}`}>
          <span className="connection-banner-icon">!</span>
          {status === "connecting"
            ? "Connecting to server..."
            : status === "reconnecting"
              ? `Reconnecting to server...${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}`
              : "Connection lost. Retries exhausted."}
        </div>
      )}

      <div className="home-status-bar">
        <span
          className={`connection-dot ${status === "connected" ? "connected" : status === "reconnecting" || status === "connecting" ? "connecting" : "disconnected"}`}
        />
        <span className="connection-label">
          {status === "connected"
            ? "Connected"
            : status === "connecting"
              ? "Connecting..."
              : status === "reconnecting"
                ? "Reconnecting..."
                : "Disconnected"}
        </span>
        <AgentStatus agents={agents} />
      </div>

      <div className="home-content">
        {failedServices.length > 0 && (
          <ErrorSurface
            errors={failedServices.map((svc) => ({
              agentId: svc.name,
              message: svc.error,
              phase: "connection",
            }))}
          />
        )}
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

      <KeyboardShortcutHelp visible={helpVisible} onDismiss={dismissHelp} />
    </div>
  );
}
