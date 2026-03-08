import type { EventBus } from "@waibspace/event-bus";
import type { Orchestrator } from "@waibspace/orchestrator";
import type { BackgroundTaskScheduler } from "./background";
import type { MemoryStore } from "@waibspace/memory";
import type { MCPServerRegistry } from "@waibspace/connectors";
import {
  createWebSocketHandlers,
  type WebSocketData,
} from "./ws";

const PORT = Number(process.env.PORT) || 3001;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export interface ServerDeps {
  eventBus: EventBus;
  orchestrator: Orchestrator;
  scheduler?: BackgroundTaskScheduler;
  memoryStore?: MemoryStore;
  mcpRegistry?: MCPServerRegistry;
}

const startTime = Date.now();

export function startServer(deps: ServerDeps) {
  const wsHandlers = createWebSocketHandlers(deps.eventBus, deps.memoryStore);

  const server = Bun.serve<WebSocketData>({
    port: PORT,

    fetch(req, server) {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req, {
          data: {
            connectionId: crypto.randomUUID(),
            connectedAt: Date.now(),
          },
        });
        if (upgraded) return undefined;
        return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
      }

      // Health check
      if (url.pathname === "/health" && req.method === "GET") {
        return jsonResponse({
          status: "ok",
          uptime: Date.now() - startTime,
        });
      }

      // Task management endpoints
      if (url.pathname === "/api/tasks" && req.method === "GET") {
        if (!deps.scheduler) {
          return jsonResponse({ error: "Scheduler not available" }, 503);
        }
        return jsonResponse(deps.scheduler.getStatus());
      }

      if (url.pathname.match(/^\/api\/tasks\/(.+)\/toggle$/) && req.method === "POST") {
        if (!deps.scheduler) {
          return jsonResponse({ error: "Scheduler not available" }, 503);
        }
        const taskId = url.pathname.match(/^\/api\/tasks\/(.+)\/toggle$/)![1];
        const tasks = deps.scheduler.getStatus();
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
          return jsonResponse({ error: "Task not found" }, 404);
        }
        if (task.enabled) {
          deps.scheduler.disable(taskId);
        } else {
          deps.scheduler.enable(taskId);
        }
        // Return updated task
        const updated = deps.scheduler.getStatus().find(t => t.id === taskId);
        return jsonResponse(updated);
      }

      if (url.pathname.match(/^\/api\/tasks\/(.+)\/history$/) && req.method === "GET") {
        if (!deps.scheduler) {
          return jsonResponse({ error: "Scheduler not available" }, 503);
        }
        const taskId = url.pathname.match(/^\/api\/tasks\/(.+)\/history$/)![1];
        return jsonResponse(deps.scheduler.getHistory(taskId));
      }

      // ---------- MCP Server Registry endpoints ----------

      // GET /api/mcp/servers — list all servers with status
      if (url.pathname === "/api/mcp/servers" && req.method === "GET") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        return jsonResponse(deps.mcpRegistry.getServers());
      }

      // POST /api/mcp/servers — add a new server
      if (url.pathname === "/api/mcp/servers" && req.method === "POST") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        try {
          const body = await req.json();
          deps.mcpRegistry.addServer(body);
          return jsonResponse({ ok: true, id: body.id }, 201);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 400);
        }
      }

      // DELETE /api/mcp/servers/:id — remove a server
      const deleteMatch = url.pathname.match(/^\/api\/mcp\/servers\/([^/]+)$/);
      if (deleteMatch && req.method === "DELETE") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        try {
          await deps.mcpRegistry.removeServer(deleteMatch[1]);
          return jsonResponse({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 404);
        }
      }

      // POST /api/mcp/servers/:id/connect — connect to a server
      const connectMatch = url.pathname.match(/^\/api\/mcp\/servers\/([^/]+)\/connect$/);
      if (connectMatch && req.method === "POST") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        try {
          await deps.mcpRegistry.connectServer(connectMatch[1]);
          return jsonResponse({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 500);
        }
      }

      // POST /api/mcp/servers/:id/disconnect — disconnect from a server
      const disconnectMatch = url.pathname.match(/^\/api\/mcp\/servers\/([^/]+)\/disconnect$/);
      if (disconnectMatch && req.method === "POST") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        try {
          await deps.mcpRegistry.disconnectServer(disconnectMatch[1]);
          return jsonResponse({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 500);
        }
      }

      // GET /api/mcp/servers/:id/tools — list tools for a server
      const toolsMatch = url.pathname.match(/^\/api\/mcp\/servers\/([^/]+)\/tools$/);
      if (toolsMatch && req.method === "GET") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        try {
          const tools = deps.mcpRegistry.getServerTools(toolsMatch[1]);
          return jsonResponse(tools);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 404);
        }
      }

      return jsonResponse({ error: "Not found" }, 404);
    },

    websocket: wsHandlers,
  });

  return server;
}
