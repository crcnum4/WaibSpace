import type { AgentStatus as AgentStatusType } from "@waibspace/ui-renderer-contract";

export function AgentStatus({ agents }: { agents: AgentStatusType[] }) {
  const running = agents.filter((a) => a.state === "running");
  const complete = agents.filter((a) => a.state === "complete");

  if (agents.length === 0) return null;

  return (
    <div className="agent-status">
      <span>
        {complete.length}/{agents.length} agents complete
      </span>
      {running.length > 0 && (
        <span className="agent-running">Processing...</span>
      )}
    </div>
  );
}
