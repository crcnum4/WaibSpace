import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type {
  ComposedLayout,
  AgentStatus as AgentStatusType,
} from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { useWebSocket } from "../hooks/useWebSocket";
import { SurfaceRenderer } from "../components/SurfaceRenderer";
import { BlockSurfaceRenderer } from "../components/BlockSurfaceRenderer";
import { AgentStatus } from "../components/AgentStatus";
import { ChatInput } from "../components/ChatInput";
import { WelcomeState } from "../components/WelcomeState";
import { ErrorSurface } from "../components/ErrorSurface";
import { BlockInspector, BlockInspectorToggle } from "../blocks/BlockInspector";
import { composedLayoutToBlocks } from "../blocks/transformers";

const WS_URL = `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}/ws`;

export default function HomePage() {
  const { send, lastMessage, status } = useWebSocket(WS_URL);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useState<ComposedLayout | null>(null);
  const [agents, setAgents] = useState<AgentStatusType[]>([]);
  const [hasRequestedAmbient, setHasRequestedAmbient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [observations, setObservations] = useState<
    Array<{ type: string; payload: unknown; time: string }>
  >([]);

  const useBlocks = searchParams.get("renderer") === "blocks";

  const toggleRenderer = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("renderer") === "blocks") {
        next.delete("renderer");
      } else {
        next.set("renderer", "blocks");
      }
      return next;
    });
  }, [setSearchParams]);

  // Derive block tree for the inspector
  const inspectorBlocks = useMemo(() => {
    if (!useBlocks || !layout || layout.surfaces.length === 0) return [];
    return composedLayoutToBlocks(layout);
  }, [useBlocks, layout]);

  // Request ambient state on initial connection
  useEffect(() => {
    if (status === "connected" && !hasRequestedAmbient) {
      send("user.message", { text: "show ambient state" });
      setHasRequestedAmbient(true);
      setIsLoading(true);
    }
  }, [status, hasRequestedAmbient, send]);

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
      // Clear the state so it doesn't re-send on re-render
      window.history.replaceState({}, "");
    }
  }, [location.state, status, send]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "surface.update":
        setLayout(lastMessage.payload as ComposedLayout);
        setIsLoading(false);
        setErrorMessage(null);
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
        const errorPayload = lastMessage.payload as {
          message: string;
          code: string;
        };
        setErrorMessage(errorPayload.message);
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
      // Approval surfaces: emit approval.response instead of user.interaction
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

      // Email send-reply: emit with full context for policy evaluation
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

        <button
          onClick={toggleRenderer}
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid var(--border, #333)",
            background: useBlocks ? "var(--accent, #7dd3fc)" : "transparent",
            color: useBlocks ? "#000" : "var(--text-secondary, #aaa)",
            cursor: "pointer",
          }}
          title="Toggle between SurfaceRenderer and BlockSurfaceRenderer"
        >
          {useBlocks ? "Blocks" : "Surfaces"}
        </button>
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
          useBlocks ? (
            <BlockSurfaceRenderer
              layout={layout}
              onAction={handleAction}
              onInteraction={handleInteraction}
              isLoading={isLoading}
            />
          ) : (
            <SurfaceRenderer
              layout={layout}
              onAction={handleAction}
              onInteraction={handleInteraction}
              isLoading={isLoading}
            />
          )
        ) : (
          <WelcomeState onSuggest={handleSend} />
        )}
      </div>

      <div className="home-chat">
        <ChatInput onSend={handleSend} placeholder="Ask WaibSpace anything..." />
      </div>

      {useBlocks && (
        <>
          <BlockInspectorToggle onClick={() => setInspectorOpen((o) => !o)} />
          <BlockInspector
            blocks={inspectorBlocks}
            observations={observations}
            isOpen={inspectorOpen}
            onToggle={() => setInspectorOpen((o) => !o)}
          />
        </>
      )}
    </div>
  );
}
