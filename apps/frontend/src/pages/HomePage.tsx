import { useEffect, useState, useCallback } from "react";
import type {
  ComposedLayout,
  AgentStatus as AgentStatusType,
} from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { useWebSocket } from "../hooks/useWebSocket";
import { SurfaceRenderer } from "../components/SurfaceRenderer";
import { AgentStatus } from "../components/AgentStatus";
import { ChatInput } from "../components/ChatInput";
import { WelcomeState } from "../components/WelcomeState";
import { ErrorSurface } from "../components/ErrorSurface";

const WS_URL = `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}/ws`;

export default function HomePage() {
  const { send, lastMessage, status } = useWebSocket(WS_URL);
  const [layout, setLayout] = useState<ComposedLayout | null>(null);
  const [agents, setAgents] = useState<AgentStatusType[]>([]);
  const [hasRequestedAmbient, setHasRequestedAmbient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Request ambient state on initial connection
  useEffect(() => {
    if (status === "connected" && !hasRequestedAmbient) {
      send("user.message", { text: "show ambient state" });
      setHasRequestedAmbient(true);
      setIsLoading(true);
    }
  }, [status, hasRequestedAmbient, send]);

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
          <SurfaceRenderer
            layout={layout}
            onAction={handleAction}
            onInteraction={handleInteraction}
            isLoading={isLoading}
          />
        ) : (
          <WelcomeState onSuggest={handleSend} />
        )}
      </div>

      <div className="home-chat">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
