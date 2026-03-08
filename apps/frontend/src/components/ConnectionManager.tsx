import { useState, useEffect, useCallback, useRef } from "react";
import type { MCPServer, MCPTool } from "../types/mcp";

const POLL_INTERVAL = 5000;

export function ConnectionManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [tools, setTools] = useState<Record<string, MCPTool[]>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [formTransport, setFormTransport] = useState<"stdio" | "sse">("stdio");
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch {
      // silent polling failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    pollRef.current = setInterval(fetchServers, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchServers]);

  const loadTools = async (serverId: string) => {
    try {
      const res = await fetch(`/api/mcp/servers/${serverId}/tools`);
      if (res.ok) {
        const data = await res.json();
        setTools((prev) => ({ ...prev, [serverId]: data }));
      }
    } catch {
      // ignore
    }
  };

  const toggleExpanded = (serverId: string) => {
    if (expandedServer === serverId) {
      setExpandedServer(null);
    } else {
      setExpandedServer(serverId);
      if (!tools[serverId]) {
        loadTools(serverId);
      }
    }
  };

  const connectServer = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/mcp/servers/${id}/connect`, { method: "POST" });
      await fetchServers();
    } finally {
      setActionLoading(null);
    }
  };

  const disconnectServer = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/mcp/servers/${id}/disconnect`, { method: "POST" });
      await fetchServers();
    } finally {
      setActionLoading(null);
    }
  };

  const deleteServer = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/mcp/servers/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      await fetchServers();
    } finally {
      setActionLoading(null);
    }
  };

  const addServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const config: Record<string, unknown> = {
      name: formName.trim(),
      transport: formTransport,
    };

    if (formTransport === "stdio") {
      if (!formCommand.trim()) return;
      config.command = formCommand.trim();
      if (formArgs.trim()) {
        config.args = formArgs.split(",").map((a) => a.trim()).filter(Boolean);
      }
    } else {
      if (!formUrl.trim()) return;
      config.url = formUrl.trim();
    }

    setActionLoading("add");
    try {
      await fetch("/api/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setFormName("");
      setFormCommand("");
      setFormArgs("");
      setFormUrl("");
      setShowAddForm(false);
      await fetchServers();
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusClass = (server: MCPServer) => {
    if (server.connected) return "connected";
    return "disconnected";
  };

  const getStatusLabel = (server: MCPServer) => {
    if (server.connected) return "Connected";
    return "Disconnected";
  };

  if (loading) {
    return (
      <div className="conn-loading">
        <span className="conn-loading-dot" />
        Loading connections...
      </div>
    );
  }

  return (
    <div className="connection-manager">
      <div className="conn-header">
        <h3>Connections</h3>
        <button
          className="conn-add-btn"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Connection"}
        </button>
      </div>

      {showAddForm && (
        <form className="conn-form" onSubmit={addServer}>
          <div className="conn-form-row">
            <label className="conn-label">Transport Type</label>
            <div className="conn-transport-selector">
              <button
                type="button"
                className={`conn-transport-btn ${formTransport === "stdio" ? "active" : ""}`}
                onClick={() => setFormTransport("stdio")}
              >
                stdio
              </button>
              <button
                type="button"
                className={`conn-transport-btn ${formTransport === "sse" ? "active" : ""}`}
                onClick={() => setFormTransport("sse")}
              >
                HTTP
              </button>
            </div>
          </div>

          <div className="conn-form-row">
            <label className="conn-label" htmlFor="conn-name">
              Server Name
            </label>
            <input
              id="conn-name"
              className="conn-input"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="My MCP Server"
              required
            />
          </div>

          {formTransport === "stdio" ? (
            <>
              <div className="conn-form-row">
                <label className="conn-label" htmlFor="conn-command">
                  Command
                </label>
                <input
                  id="conn-command"
                  className="conn-input"
                  type="text"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="npx, python, node..."
                  required
                />
              </div>
              <div className="conn-form-row">
                <label className="conn-label" htmlFor="conn-args">
                  Arguments (comma-separated)
                </label>
                <input
                  id="conn-args"
                  className="conn-input"
                  type="text"
                  value={formArgs}
                  onChange={(e) => setFormArgs(e.target.value)}
                  placeholder="-y, @modelcontextprotocol/server-github"
                />
              </div>
            </>
          ) : (
            <div className="conn-form-row">
              <label className="conn-label" htmlFor="conn-url">
                Server URL
              </label>
              <input
                id="conn-url"
                className="conn-input"
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="http://localhost:3000/sse"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="conn-submit-btn"
            disabled={actionLoading === "add"}
          >
            {actionLoading === "add" ? "Adding..." : "Add Server"}
          </button>
        </form>
      )}

      <div className="conn-list">
        {servers.length === 0 && (
          <div className="conn-empty">
            No MCP server connections configured. Add one to get started.
          </div>
        )}

        {servers.map((server) => (
          <div key={server.config.id} className="conn-card">
            <div className="conn-card-header">
              <div className="conn-card-info">
                <span
                  className={`connection-dot ${getStatusClass(server)}`}
                  title={getStatusLabel(server)}
                />
                <span className="conn-card-name">{server.config.name}</span>
                <span className="conn-badge">{server.config.transport}</span>
              </div>
              <div className="conn-card-actions">
                {server.connected && server.toolCount > 0 && (
                  <span className="conn-tool-count">
                    {server.toolCount} tool{server.toolCount !== 1 ? "s" : ""}{" "}
                    available
                  </span>
                )}
                <button
                  className={`conn-action-btn ${server.connected ? "disconnect" : "connect"}`}
                  onClick={() =>
                    server.connected
                      ? disconnectServer(server.config.id)
                      : connectServer(server.config.id)
                  }
                  disabled={actionLoading === server.config.id}
                >
                  {actionLoading === server.config.id
                    ? "..."
                    : server.connected
                      ? "Disconnect"
                      : "Connect"}
                </button>
                {deleteConfirm === server.config.id ? (
                  <div className="conn-delete-confirm">
                    <span>Delete?</span>
                    <button
                      className="conn-action-btn danger"
                      onClick={() => deleteServer(server.config.id)}
                      disabled={actionLoading === server.config.id}
                    >
                      Yes
                    </button>
                    <button
                      className="conn-action-btn"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="conn-action-btn danger"
                    onClick={() => setDeleteConfirm(server.config.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {server.connected && (
              <button
                className="conn-expand-btn"
                onClick={() => toggleExpanded(server.config.id)}
              >
                {expandedServer === server.config.id
                  ? "Hide tools"
                  : "Show tools"}
              </button>
            )}

            {expandedServer === server.config.id && (
              <div className="conn-tools">
                {!tools[server.config.id] ? (
                  <span className="conn-tools-loading">Loading tools...</span>
                ) : tools[server.config.id].length === 0 ? (
                  <span className="conn-tools-empty">
                    No tools discovered.
                  </span>
                ) : (
                  <ul className="conn-tool-list">
                    {tools[server.config.id].map((tool) => (
                      <li key={tool.name} className="conn-tool-item">
                        <span className="conn-tool-name">{tool.name}</span>
                        {tool.description && (
                          <span className="conn-tool-desc">
                            {tool.description}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
