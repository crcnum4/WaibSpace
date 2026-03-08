import { EventBus } from "@waibspace/event-bus";
import type { WaibEvent } from "@waibspace/types";
import type { ServerMessage, ComposedLayout } from "@waibspace/ui-renderer-contract";
import { Orchestrator, AgentRegistry } from "@waibspace/orchestrator";
import {
  InputNormalizerAgent,
  URLIntentParserAgent,
  IntentAgent,
  ConfidenceScorerAgent,
} from "@waibspace/agents";
import {
  ModelProviderRegistry,
  AnthropicProvider,
} from "@waibspace/model-provider";
import { MemoryStore } from "@waibspace/memory";
import { startServer } from "./server";
import { broadcast } from "./ws";

// ---------- 1. Event Bus ----------
const bus = new EventBus();

// ---------- 2. Model Provider ----------
const modelRegistry = new ModelProviderRegistry();
modelRegistry.register(new AnthropicProvider());

// ---------- 3. Agent Registry ----------
const agentRegistry = new AgentRegistry();
agentRegistry.register(new InputNormalizerAgent());
agentRegistry.register(new URLIntentParserAgent());
agentRegistry.register(new IntentAgent());
agentRegistry.register(new ConfidenceScorerAgent());

console.log(
  `[backend] Registered ${agentRegistry.getAll().length} agents: ${agentRegistry.getAll().map((a) => a.id).join(", ")}`,
);

// ---------- 4. Orchestrator ----------
const orchestrator = new Orchestrator(bus, agentRegistry, {
  modelProvider: modelRegistry,
});

// ---------- 5. Route user events to orchestrator ----------
const USER_EVENT_PATTERNS = [
  "user.*",
  "policy.approval.*",
];

for (const pattern of USER_EVENT_PATTERNS) {
  bus.on(pattern, async (event: WaibEvent) => {
    const traceId = event.traceId;
    console.log(
      `[backend] [trace:${traceId}] Routing event "${event.type}" to orchestrator`,
    );
    try {
      await orchestrator.processEvent(event);
    } catch (err) {
      console.error(
        `[backend] [trace:${traceId}] Orchestrator error for "${event.type}":`,
        err,
      );
      // Send error to all clients with partial status
      const errorMessage =
        err instanceof Error ? err.message : "Unknown orchestrator error";
      const errorMsg: ServerMessage = {
        type: "error",
        payload: {
          message: errorMessage,
          code: "ORCHESTRATOR_ERROR",
        },
      };
      broadcast(errorMsg);
    }
  });
}

// ---------- 6. Broadcast composed surfaces to WebSocket clients ----------
bus.on("surface.composed", (event: WaibEvent) => {
  const message: ServerMessage = {
    type: "surface.update",
    payload: event.payload as ComposedLayout,
  };
  console.log(
    `[backend] [trace:${event.traceId}] Broadcasting surface.composed to WebSocket clients`,
  );
  broadcast(message);
});

// ---------- 7. Memory Store ----------
const memoryStore = new MemoryStore(undefined, bus);

// ---------- 8. Start HTTP/WebSocket server ----------
const server = startServer({ eventBus: bus, orchestrator, memoryStore });

const PORT = Number(process.env.PORT) || 3001;
console.log(`[backend] WaibSpace backend started`);
console.log(`[backend] HTTP & WebSocket listening on port ${PORT}`);
console.log(`[backend] Started at ${new Date().toISOString()}`);
