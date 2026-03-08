import { EventBus } from "@waibspace/event-bus";
import type { WaibEvent } from "@waibspace/types";
import type { ServerMessage, ComposedLayout } from "@waibspace/ui-renderer-contract";
import { startServer } from "./server";
import { broadcast } from "./ws";

// Initialize event bus
const bus = new EventBus();

// Subscribe to surface.composed events and broadcast to all WebSocket clients
bus.on("surface.composed", (event: WaibEvent) => {
  const message: ServerMessage = {
    type: "surface.update",
    payload: event.payload as ComposedLayout,
  };
  broadcast(message);
});

// Start HTTP/WebSocket server
const server = startServer(bus);

const PORT = Number(process.env.PORT) || 3001;
console.log(`[backend] WaibSpace backend started`);
console.log(`[backend] HTTP & WebSocket listening on port ${PORT}`);
console.log(`[backend] Started at ${new Date().toISOString()}`);
