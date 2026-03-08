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
 * Map ClientMessage types to WaibEvent types for the event bus.
 */
function mapClientMessageToEventType(msg: ClientMessage): string {
  switch (msg.type) {
    case "user.message":
      return "user.message.received";
    case "user.interaction": {
      const interaction = msg.payload.interaction || "clicked";
      return `user.interaction.${interaction}`;
    }
    case "user.intent.url":
      return "user.intent.url_received";
    case "approval.response":
      return "policy.approval.response";
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
      const traceId = createTraceId();

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error(`[ws] [trace:${traceId}] Invalid JSON from ${ws.data.connectionId}`);
        const errorMsg: ServerMessage = {
          type: "error",
          payload: { message: "Invalid JSON", code: "INVALID_JSON" },
        };
        ws.send(JSON.stringify(errorMsg));
        return;
      }

      if (!isValidClientMessage(parsed)) {
        console.error(`[ws] [trace:${traceId}] Invalid message format from ${ws.data.connectionId}`);
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
      const eventType = mapClientMessageToEventType(clientMsg);

      console.log(
        `[ws] [trace:${traceId}] message from ${ws.data.connectionId}: ${clientMsg.type} -> ${eventType}`,
      );

      // Create a WaibEvent and emit to the event bus
      const event = createEvent(
        eventType,
        clientMsg.payload,
        `ws:${ws.data.connectionId}`,
        traceId,
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
