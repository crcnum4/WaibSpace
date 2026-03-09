import type { ServerWebSocket } from "bun";
import type { ServerMessage, ClientMessage, ComposedLayout, LayoutDirective } from "@waibspace/ui-renderer-contract";
import { isValidClientMessage } from "@waibspace/ui-renderer-contract";
import { EventBus, createEvent, createTraceId } from "@waibspace/event-bus";
import type { MemoryStore } from "@waibspace/memory";
import type { SurfaceSpec } from "@waibspace/types";
import { createLogger } from "@waibspace/logger";

const log = createLogger("ws");

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
    try {
      ws.send(raw);
    } catch (err) {
      log.error("Broadcast send failed", {
        connectionId: ws.data.connectionId,
        error: err instanceof Error ? err.message : String(err),
      });
      clients.delete(ws);
    }
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
 * Send any pre-prepared surfaces from the memory store to a newly connected client.
 *
 * Background tasks store pending surfaces under the "system" category with keys
 * like "pending-surface:*". This function retrieves them, composes a layout,
 * and sends a surface.update message so the UI is immediately populated.
 */
async function sendPendingSurfaces(
  ws: ServerWebSocket<WebSocketData>,
  memoryStore: MemoryStore,
): Promise<void> {
  const systemEntries = memoryStore.getAll("system");
  const pendingEntries = systemEntries.filter((e) =>
    e.key.startsWith("pending-surface:"),
  );

  if (pendingEntries.length === 0) return;

  // Extract SurfaceSpec from each entry
  const surfaces: SurfaceSpec[] = [];
  for (const entry of pendingEntries) {
    const value = entry.value as Record<string, unknown> | undefined;
    if (
      value &&
      typeof value === "object" &&
      typeof value.surfaceType === "string" &&
      typeof value.surfaceId === "string"
    ) {
      surfaces.push(value as unknown as SurfaceSpec);
    }
  }

  if (surfaces.length === 0) return;

  // Sort by priority (highest first)
  surfaces.sort((a, b) => b.priority - a.priority);

  // Build LayoutDirectives (max 4 visible)
  const MAX_VISIBLE = 4;
  const layout: LayoutDirective[] = surfaces
    .slice(0, MAX_VISIBLE)
    .map((surface, idx) => {
      const position = surface.layoutHints.position ?? "secondary";
      const defaultWidth = position === "primary" ? "full" : "half";
      return {
        surfaceId: surface.surfaceId,
        position: idx,
        width: surface.layoutHints.width ?? defaultWidth,
        prominence: surface.layoutHints.prominence ?? "standard",
      };
    });

  const traceId = createTraceId();
  const composedLayout: ComposedLayout = {
    surfaces,
    layout,
    timestamp: Date.now(),
    traceId,
  };

  const message: ServerMessage = {
    type: "surface.update",
    payload: composedLayout,
  };

  ws.send(JSON.stringify(message));

  const preparedAt = pendingEntries.map((e) => ({
    key: e.key,
    preparedAt: e.updatedAt,
  }));
  log.child({ traceId }).info("Sent pending surfaces", {
    connectionId: ws.data.connectionId,
    surfaceCount: surfaces.length,
    preparedAt,
  });
}

/**
 * Create Bun WebSocket handlers wired to the given EventBus.
 */
export function createWebSocketHandlers(bus: EventBus, memoryStore?: MemoryStore) {
  return {
    open(ws: ServerWebSocket<WebSocketData>) {
      clients.add(ws);
      log.info("Client connected", { connectionId: ws.data.connectionId, totalClients: clients.size });

      // Send any pre-prepared surfaces to the newly connected client
      if (memoryStore) {
        sendPendingSurfaces(ws, memoryStore).catch((err) => {
          log.error("Failed to send pending surfaces", {
            connectionId: ws.data.connectionId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      const raw = typeof message === "string" ? message : message.toString();
      const traceId = createTraceId();

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        log.child({ traceId }).error("Invalid JSON from client", { connectionId: ws.data.connectionId });
        const errorMsg: ServerMessage = {
          type: "error",
          payload: { message: "Invalid JSON", code: "INVALID_JSON" },
        };
        ws.send(JSON.stringify(errorMsg));
        return;
      }

      if (!isValidClientMessage(parsed)) {
        log.child({ traceId }).error("Invalid message format", { connectionId: ws.data.connectionId });
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
      const source = `ws:${ws.data.connectionId}`;

      log.child({ traceId }).debug("Message received", {
        connectionId: ws.data.connectionId,
        messageType: clientMsg.type,
        eventType,
      });

      // If this is a user.interaction with a batch, emit individual events for each observation
      if (clientMsg.type === "user.interaction" && clientMsg.payload.batch && clientMsg.payload.batch.length > 0) {
        const { batch, ...basePayload } = clientMsg.payload;
        log.child({ traceId }).debug("Processing observation batch", { batchSize: batch.length });
        for (const observation of batch) {
          const obsEventType = `user.interaction.${observation.interactionType}`;
          const obsPayload = {
            ...basePayload,
            interaction: observation.interactionType,
            blockId: observation.blockId,
            blockType: observation.blockType,
            wasPlanned: observation.wasPlanned,
            position: observation.position,
            dwellMs: observation.dwellMs,
            viewportRatio: observation.viewportRatio,
            timestamp: observation.timestamp,
          };
          const obsEvent = createEvent(obsEventType, obsPayload, source, traceId);
          bus.emit(obsEvent);
        }
      } else {
        // Create a WaibEvent and emit to the event bus
        const event = createEvent(
          eventType,
          clientMsg.payload,
          source,
          traceId,
        );
        bus.emit(event);
      }
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      clients.delete(ws);
      log.info("Client disconnected", { connectionId: ws.data.connectionId, totalClients: clients.size });
    },

    error(ws: ServerWebSocket<WebSocketData>, error: Error) {
      log.error("WebSocket error", { connectionId: ws.data.connectionId, error: error.message });
      clients.delete(ws);
    },
  };
}
