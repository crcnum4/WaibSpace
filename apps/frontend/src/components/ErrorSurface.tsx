import type { AgentError } from "@waibspace/ui-renderer-contract";

interface ErrorSurfaceProps {
  errors: AgentError[];
}

/**
 * Renders user-friendly error messages when agents fail.
 * Maps agent IDs to human-readable service names.
 */
export function ErrorSurface({ errors }: ErrorSurfaceProps) {
  if (errors.length === 0) return null;

  return (
    <div className="error-surface">
      <div className="error-surface-header">
        <span className="error-surface-icon">!</span>
        <span>Some data could not be loaded</span>
      </div>
      <ul className="error-surface-list">
        {errors.map((err) => (
          <li key={err.agentId} className="error-surface-item">
            <span className="error-surface-agent">
              {friendlyAgentName(err.agentId)}
            </span>
            <span className="error-surface-message">
              {friendlyErrorMessage(err.message)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Map agent IDs to user-friendly names */
function friendlyAgentName(agentId: string): string {
  const names: Record<string, string> = {
    "data-retrieval": "Data Service",
    "inbox-surface": "Email",
    "calendar-surface": "Calendar",
    "discovery-surface": "Search",
    "context-planner": "Context",
    "connector-selection": "Connectors",
    "memory-retrieval": "Memory",
    "layout-composer": "Layout",
  };
  return names[agentId] ?? agentId;
}

/** Convert error messages to user-friendly text */
function friendlyErrorMessage(message: string): string {
  if (message.includes("timed out") || message.includes("timeout")) {
    return "Request timed out - please try again";
  }
  if (message.includes("ECONNREFUSED")) {
    return "Server not running - connection refused";
  }
  if (message.includes("ENOTFOUND")) {
    return "Server not found - check configuration";
  }
  if (message.includes("ENOENT") || message.includes("not found")) {
    return "Server command not found - is it installed?";
  }
  if (message.includes("401") || message.includes("403") || message.includes("Unauthorized")) {
    return "Authentication required - please reconnect";
  }
  if (message.includes("Failed to connect to MCP server")) {
    // Extract the actionable part after the server name
    const match = message.match(/MCP server "[^"]+": (.+)/);
    if (match) return match[1];
  }
  // Don't expose raw error messages to users
  if (message.length > 120 || message.includes("Error:")) {
    return "An unexpected error occurred";
  }
  return message;
}
