import { useEffect, useState } from "react";
import type { AgentStatus as AgentStatusType } from "@waibspace/ui-renderer-contract";

/** Maps agent names to user-friendly status messages. */
const agentMessages: Record<string, string> = {
  email: "Fetching emails...",
  inbox: "Analyzing inbox...",
  calendar: "Checking calendar...",
  discovery: "Searching knowledge base...",
  search: "Looking things up...",
  compose: "Composing layout...",
  approval: "Evaluating actions...",
};

function getAgentMessage(agentName: string): string {
  const lower = agentName.toLowerCase();
  for (const [key, msg] of Object.entries(agentMessages)) {
    if (lower.includes(key)) return msg;
  }
  return `Processing ${agentName}...`;
}

export function AgentStatus({ agents }: { agents: AgentStatusType[] }) {
  const running = agents.filter((a) => a.state === "running");
  const complete = agents.filter((a) => a.state === "complete");
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [isFading, setIsFading] = useState(false);

  const runningKey = running.map((r) => r.agentId).join(",");

  // Cycle through running agent messages with fade transitions
  useEffect(() => {
    if (running.length === 0) {
      if (visibleMessage) {
        setIsFading(true);
        const t = setTimeout(() => {
          setVisibleMessage(null);
          setIsFading(false);
        }, 300);
        return () => clearTimeout(t);
      }
      return;
    }

    // Show the first running agent's message
    const msg = getAgentMessage(running[0].agentId);
    setVisibleMessage(msg);
    setIsFading(false);

    // If multiple agents, cycle through them
    if (running.length <= 1) return;

    let idx = 0;
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        idx = (idx + 1) % running.length;
        setVisibleMessage(getAgentMessage(running[idx].agentId));
        setIsFading(false);
      }, 300);
    }, 2500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningKey]);

  if (agents.length === 0) return null;

  return (
    <div className="agent-status">
      <span className="agent-progress">
        {complete.length}/{agents.length} agents complete
      </span>
      {visibleMessage && (
        <span
          className={`agent-message ${isFading ? "agent-message-exit" : "agent-message-enter"}`}
        >
          {visibleMessage}
        </span>
      )}
    </div>
  );
}
