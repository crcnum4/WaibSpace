import { useEffect, useState, useCallback } from "react";
import type { ComposedLayout, AgentStatus as AgentStatusType } from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { useWebSocket } from "../hooks/useWebSocket";
import { SurfaceRenderer } from "../components/SurfaceRenderer";
import { AgentStatus } from "../components/AgentStatus";
import { ChatInput } from "../components/ChatInput";

const WS_URL = `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || 3001}`;

export default function HomePage() {
  const { send, lastMessage, status } = useWebSocket(WS_URL);
  const [layout, setLayout] = useState<ComposedLayout | null>(null);
  const [agents, setAgents] = useState<AgentStatusType[]>([]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "surface.update":
        setLayout(lastMessage.payload as ComposedLayout);
        break;
      case "status": {
        const statusPayload = lastMessage.payload as { phase: string; agents: AgentStatusType[] };
        setAgents(statusPayload.agents);
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

  const handleSend = useCallback(
    (text: string) => {
      send("user.message", { text });
    },
    [send],
  );

  return (
    <div className="page home-page">
      <div className="home-status-bar">
        {status !== "connected" && (
          <span className="connection-status">{status}...</span>
        )}
        <AgentStatus agents={agents} />
      </div>

      <SurfaceRenderer
        layout={layout}
        onAction={handleAction}
        onInteraction={handleInteraction}
      />

      <div className="home-chat">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
