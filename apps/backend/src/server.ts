import type { EventBus } from "@waibspace/event-bus";
import type { Orchestrator } from "@waibspace/orchestrator";
import type { MemoryStore } from "@waibspace/memory";
import {
  createWebSocketHandlers,
  type WebSocketData,
} from "./ws";

const PORT = Number(process.env.PORT) || 3001;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  memoryStore?: MemoryStore;
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

      return jsonResponse({ error: "Not found" }, 404);
    },

    websocket: wsHandlers,
  });

  return server;
}
