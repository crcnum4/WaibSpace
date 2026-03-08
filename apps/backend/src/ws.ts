import type { ServerWebSocket } from "bun";
import type { ServerMessage, ClientMessage } from "@waibspace/ui-renderer-contract";
import { isValidClientMessage } from "@waibspace/ui-renderer-contract";
import { EventBus, createEvent, createTraceId } from "@waibspace/event-bus";

export interface WebSocketData {
  connectionId: string;
  connectedAt: number;
}

const clients = new Set<ServerWebSocket<WebSocketData>>();

export function getClients(): Set<ServerWebSocket<WebSocketData>> {
  return clients;
}

/**
 * Broadcast a ServerMessage to all connected WebSocket clients.
 */
export function broadcast(message: ServerMessage): void {
  const raw = JSON.stringify(message);
  for (const ws of clients) {
    ws.send(raw);
  }
}

/**
 * Create Bun WebSocket handlers wired to the given EventBus.
 */
export function createWebSocketHandlers(bus: EventBus) {
  return {
    open(ws: ServerWebSocket<WebSocketData>) {
      clients.add(ws);
      console.log(
        `[ws] client connected: ${ws.data.connectionId} (total: ${clients.size})`,
      );
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      const raw = typeof message === "string" ? message : message.toString();

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const errorMsg: ServerMessage = {
          type: "error",
          payload: { message: "Invalid JSON", code: "INVALID_JSON" },
        };
        ws.send(JSON.stringify(errorMsg));
        return;
      }

      if (!isValidClientMessage(parsed)) {
        const errorMsg: ServerMessage = {
          type: "error",
          payload: {
            message: "Invalid client message format",
            code: "INVALID_MESSAGE",
          },
        };
        ws.send(JSON.stringify(errorMsg));
        return;
      }

      const clientMsg = parsed as ClientMessage;
      console.log(
        `[ws] message from ${ws.data.connectionId}: ${clientMsg.type}`,
      );

      // Map client message type to WaibEvent type and emit
      const event = createEvent(
        clientMsg.type,
        clientMsg.payload,
        `ws:${ws.data.connectionId}`,
        createTraceId(),
      );
      bus.emit(event);
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      clients.delete(ws);
      console.log(
        `[ws] client disconnected: ${ws.data.connectionId} (total: ${clients.size})`,
      );
    },

    error(ws: ServerWebSocket<WebSocketData>, error: Error) {
      console.error(`[ws] error for ${ws.data.connectionId}:`, error);
      clients.delete(ws);
    },
  };
}
