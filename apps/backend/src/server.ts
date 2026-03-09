import type { EventBus } from "@waibspace/event-bus";
import type { Orchestrator } from "@waibspace/orchestrator";
import type { BackgroundTaskScheduler } from "./background";
import type { MemoryStore } from "@waibspace/memory";
import type { WaibDatabase } from "@waibspace/db";
import type { MCPServerRegistry, MCPServerConfig } from "@waibspace/connectors";
import { findTemplate, MCP_SERVER_CATALOG } from "@waibspace/connectors";
import type { ConnectorRegistry } from "@waibspace/connectors";
import type { IPendingActionStore, PendingActionStatus } from "@waibspace/types";
import {
  createWebSocketHandlers,
  type WebSocketData,
} from "./ws";
import { RateLimiter, loadRateLimitConfig } from "./rate-limiter";

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
  connectorRegistry?: ConnectorRegistry;
  db?: WaibDatabase;
  pendingActionStore?: IPendingActionStore;
}

const startTime = Date.now();

export function startServer(deps: ServerDeps) {
  const wsHandlers = createWebSocketHandlers(deps.eventBus, deps.memoryStore);
  const rateLimiter = new RateLimiter(loadRateLimitConfig());

  const server = Bun.serve<WebSocketData>({
    port: PORT,

    async fetch(req, server) {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // WebSocket upgrade — not rate-limited
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

      // Health check — not rate-limited
      if (url.pathname === "/health" && req.method === "GET") {
        return jsonResponse({
          status: "ok",
          uptime: Date.now() - startTime,
        });
      }

      // --- Rate limiting (applies to all /api/* routes below) ---
      if (url.pathname.startsWith("/api/")) {
        const clientIp =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          "unknown";
        const result = rateLimiter.check(clientIp);

        if (!result.allowed) {
          return new Response(
            JSON.stringify({
              error: "Too many requests",
              retryAfter: result.retryAfterSecs,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(result.retryAfterSecs),
                "X-RateLimit-Limit": String(rateLimiter.config.maxRequests),
                "X-RateLimit-Remaining": "0",
                ...CORS_HEADERS,
              },
            },
          );
        }
      }

      // ---------- Agent benchmark endpoints ----------

      // GET /api/benchmarks — agent performance metrics summary
      if (url.pathname === "/api/benchmarks" && req.method === "GET") {
        return jsonResponse(deps.orchestrator.benchmarks.getSummary());
      }

      // POST /api/benchmarks/reset — clear collected benchmark data
      if (url.pathname === "/api/benchmarks/reset" && req.method === "POST") {
        deps.orchestrator.benchmarks.reset();
        return jsonResponse({ ok: true });
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

      // GET /api/mcp/health — connector health metrics
      if (url.pathname === "/api/mcp/health" && req.method === "GET") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        return jsonResponse(deps.mcpRegistry.getHealthMetrics());
      }

      // POST /api/mcp/health/check — trigger an immediate health check
      if (url.pathname === "/api/mcp/health/check" && req.method === "POST") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        await deps.mcpRegistry.runHealthChecks();
        return jsonResponse(deps.mcpRegistry.getHealthMetrics());
      }

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

      // POST /api/mcp/servers/:id/test — ping a connected server
      const testMatch = url.pathname.match(/^\/api\/mcp\/servers\/([^/]+)\/test$/);
      if (testMatch && req.method === "POST") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        const result = await deps.mcpRegistry.testServer(testMatch[1]);
        return jsonResponse(result, result.ok ? 200 : 502);
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

      // GET /api/logs?limit=50&level=error — query event logs
      if (url.pathname === "/api/logs" && req.method === "GET") {
        if (!deps.db) {
          return jsonResponse({ error: "Database not available" }, 503);
        }
        const limit = Number(url.searchParams.get("limit") ?? "50");
        const level = url.searchParams.get("level") ?? undefined;
        const traceId = url.searchParams.get("trace") ?? undefined;

        let rows;
        if (traceId) {
          rows = deps.db.getEventsByTrace(traceId);
        } else {
          rows = deps.db.getRecentEvents(limit, level);
        }

        return jsonResponse(
          rows.map((r) => ({
            ...r,
            payload: JSON.parse(r.payload),
          })),
        );
      }

      // GET /api/mcp/catalog — list available MCP server templates
      if (url.pathname === "/api/mcp/catalog" && req.method === "GET") {
        return jsonResponse(
          MCP_SERVER_CATALOG.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            icon: t.icon,
            categories: t.categories,
            credentialCount: t.requiredCredentials.length,
          })),
        );
      }

      // GET /api/mcp/catalog/:id — get full template details (including credential specs)
      const catalogDetailMatch = url.pathname.match(/^\/api\/mcp\/catalog\/([^/]+)$/);
      if (catalogDetailMatch && req.method === "GET") {
        const template = findTemplate(catalogDetailMatch[1]);
        if (!template) {
          return jsonResponse({ error: "Template not found" }, 404);
        }
        return jsonResponse({
          id: template.id,
          name: template.name,
          description: template.description,
          icon: template.icon,
          categories: template.categories,
          requiredCredentials: template.requiredCredentials,
        });
      }

      // POST /api/mcp/setup — set up an MCP server from catalog template
      if (url.pathname === "/api/mcp/setup" && req.method === "POST") {
        if (!deps.mcpRegistry) {
          return jsonResponse({ error: "MCP registry not available" }, 503);
        }
        try {
          const body = (await req.json()) as {
            templateId: string;
            credentials: Record<string, string>;
          };
          const { templateId, credentials } = body;

          // Look up template
          const template = findTemplate(templateId);
          if (!template) {
            return jsonResponse({ error: `Unknown service: ${templateId}` }, 400);
          }

          // Validate required credentials
          for (const cred of template.requiredCredentials) {
            if (!credentials[cred.key]) {
              return jsonResponse(
                { error: `Missing required credential: ${cred.label}` },
                400,
              );
            }
          }

          // Build MCPServerConfig from template
          const config: MCPServerConfig = {
            id: `catalog-${template.id}`,
            name: template.name,
            transport: "stdio",
            command: template.command,
            args: [...template.args],
            env: { ...(template.defaultEnv ?? {}), ...credentials },
            trustLevel: template.trustLevel,
            enabled: true,
          };

          // Remove existing server if reconnecting
          try {
            await deps.mcpRegistry.removeServer(config.id);
          } catch {
            // Not found — that's fine
          }

          // Add, connect, and register connector
          deps.mcpRegistry.addServer(config);
          await deps.mcpRegistry.connectServer(config.id);

          if (deps.connectorRegistry) {
            const connector = deps.mcpRegistry.getConnector(config.id);
            if (connector) {
              deps.connectorRegistry.register(connector);
            }
          }

          // Persist
          await deps.mcpRegistry.save();

          // Return discovered tools
          const tools = deps.mcpRegistry.getServerTools(config.id);
          return jsonResponse({
            ok: true,
            id: config.id,
            name: template.name,
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
            })),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 500);
        }
      }

      // ---------- Pending Action Store endpoints ----------

      // GET /api/actions/pending — list pending actions (optionally filter by ?status=)
      if (url.pathname === "/api/actions/pending" && req.method === "GET") {
        if (!deps.pendingActionStore) {
          return jsonResponse({ error: "Pending action store not available" }, 503);
        }
        const status = url.searchParams.get("status") as PendingActionStatus | null;
        const actions = deps.pendingActionStore.list(status ?? undefined);
        return jsonResponse(actions);
      }

      // GET /api/actions/pending/:approvalId — get a single pending action
      const actionGetMatch = url.pathname.match(/^\/api\/actions\/pending\/([^/]+)$/);
      if (actionGetMatch && req.method === "GET") {
        if (!deps.pendingActionStore) {
          return jsonResponse({ error: "Pending action store not available" }, 503);
        }
        const action = deps.pendingActionStore.get(actionGetMatch[1]);
        if (!action) {
          return jsonResponse({ error: "Action not found" }, 404);
        }
        return jsonResponse(action);
      }

      // POST /api/actions/pending/:approvalId/approve — approve a pending action
      const actionApproveMatch = url.pathname.match(/^\/api\/actions\/pending\/([^/]+)\/approve$/);
      if (actionApproveMatch && req.method === "POST") {
        if (!deps.pendingActionStore) {
          return jsonResponse({ error: "Pending action store not available" }, 503);
        }
        try {
          const updated = deps.pendingActionStore.approve(actionApproveMatch[1]);
          return jsonResponse(updated);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 400);
        }
      }

      // POST /api/actions/pending/:approvalId/deny — deny a pending action
      const actionDenyMatch = url.pathname.match(/^\/api\/actions\/pending\/([^/]+)\/deny$/);
      if (actionDenyMatch && req.method === "POST") {
        if (!deps.pendingActionStore) {
          return jsonResponse({ error: "Pending action store not available" }, 503);
        }
        try {
          let reason: string | undefined;
          try {
            const body = await req.json() as { reason?: string };
            reason = body.reason;
          } catch {
            // No body or invalid JSON — that's fine, reason is optional
          }
          const updated = deps.pendingActionStore.deny(actionDenyMatch[1], reason);
          return jsonResponse(updated);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 400);
        }
      }

      // ---------- Search endpoint ----------

      // GET /api/search?q=query — search across all connected services
      if (url.pathname === "/api/search" && req.method === "GET") {
        const query = url.searchParams.get("q");
        if (!query || !query.trim()) {
          return jsonResponse({ error: "Missing search query parameter 'q'" }, 400);
        }

        if (!deps.connectorRegistry) {
          return jsonResponse({ error: "Connector registry not available" }, 503);
        }

        const connectors = deps.connectorRegistry.getAll();
        const connectedConnectors = connectors.filter(
          (c: { isConnected(): boolean }) => c.isConnected(),
        );

        if (connectedConnectors.length === 0) {
          return jsonResponse({
            query: query.trim(),
            results: [],
            sources: [],
            totalResults: 0,
          });
        }

        const traceId = crypto.randomUUID();
        const searchResults: Array<{
          connectorId: string;
          data: unknown;
          error?: string;
        }> = [];

        // Query each connector in parallel with search-compatible operations
        const settlements = await Promise.allSettled(
          connectedConnectors.map(async (connector: { id: string; fetch(req: { operation: string; params: Record<string, unknown>; traceId: string }): Promise<{ data: unknown }> }) => {
            try {
              // Use "search" operation — connectors that don't support it will error
              const response = await connector.fetch({
                operation: "search",
                params: { query: query.trim(), maxResults: 10 },
                traceId,
              });
              return {
                connectorId: connector.id,
                data: response.data,
              };
            } catch {
              // Connector doesn't support search, skip silently
              return {
                connectorId: connector.id,
                data: null,
              };
            }
          }),
        );

        for (const settlement of settlements) {
          if (settlement.status === "fulfilled" && settlement.value.data) {
            searchResults.push(settlement.value);
          }
        }

        return jsonResponse({
          query: query.trim(),
          results: searchResults,
          sources: searchResults.map((r) => r.connectorId),
          totalResults: searchResults.length,
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    },

    websocket: wsHandlers,
  });

  // Attach cleanup so callers can stop the sweep timer on shutdown
  (server as any)._rateLimiter = rateLimiter;
  const origStop = server.stop.bind(server);
  server.stop = (closeActiveConnections?: boolean) => {
    rateLimiter.stop();
    return origStop(closeActiveConnections);
  };

  return server;
}
