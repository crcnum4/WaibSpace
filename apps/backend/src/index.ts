import { EventBus } from "@waibspace/event-bus";
import type { WaibEvent } from "@waibspace/types";
import type { ServerMessage, ComposedLayout } from "@waibspace/ui-renderer-contract";
import { Orchestrator, AgentRegistry } from "@waibspace/orchestrator";
import {
  // Perception agents
  InputNormalizerAgent,
  URLIntentParserAgent,
  // Reasoning agents
  IntentAgent,
  ConfidenceScorerAgent,
  InteractionSemanticsAgent,
  // Context agents
  ContextPlannerAgent,
  ConnectorSelectionAgent,
  DataRetrievalAgent,
  MemoryRetrievalAgent,
  PolicyGateAgent,
  // UI agents
  InboxSurfaceAgent,
  CalendarSurfaceAgent,
  DiscoverySurfaceAgent,
  ApprovalSurfaceAgent,
  ConnectionSurfaceAgent,
  GenericDataSurfaceAgent,
  LayoutComposerAgent,
  // Safety agents
  ProvenanceAnnotatorAgent,
  // Execution agents
  ActionExecutorAgent,
} from "@waibspace/agents";
import {
  ConnectorRegistry,
  WebFetchConnector,
  MCPServerRegistry,
} from "@waibspace/connectors";
import { PolicyEngine, DEFAULT_POLICY_RULES } from "@waibspace/policy";
import {
  ModelProviderRegistry,
  AnthropicProvider,
} from "@waibspace/model-provider";
import { MemoryStore, MemoryUpdatePipeline, ObservationProcessor } from "@waibspace/memory";
import { WaibDatabase } from "@waibspace/db";
import { BackgroundTaskScheduler, MVP_BACKGROUND_TASKS } from "./background";
import { startServer } from "./server";
import { broadcast } from "./ws";

// ---------- 1. Event Bus ----------
const bus = new EventBus();

// ---------- 1b. Database ----------
const db = new WaibDatabase("./data/waibspace.db");
console.log("[backend] SQLite database initialized");

// ---------- 2. Model Provider ----------
const modelRegistry = new ModelProviderRegistry();
const anthropicProvider = new AnthropicProvider();
modelRegistry.register(anthropicProvider);

// Pre-warm the Anthropic API connection (non-blocking)
anthropicProvider.warmUp().catch(() => {
  // Errors already logged inside warmUp()
});

// ---------- 3. Connector Registry ----------
const connectorRegistry = new ConnectorRegistry();

// WebFetch connector — always available (no credentials needed)
const webFetchConnector = new WebFetchConnector("web-fetch", "Web Fetch");
await webFetchConnector.connect();
connectorRegistry.register(webFetchConnector);
console.log("[backend] WebFetch connector registered");

// ---------- 4. Policy Engine ----------
const policyEngine = new PolicyEngine(DEFAULT_POLICY_RULES);
console.log(`[backend] Policy engine initialized with ${policyEngine.getRules().length} rules`);

// ---------- 4b. MCP Server Registry ----------
const mcpRegistry = new MCPServerRegistry(policyEngine, db);
await mcpRegistry.load();

// Auto-connect enabled servers and register their connectors
for (const server of mcpRegistry.getServers()) {
  if (server.config.enabled !== false) {
    try {
      await mcpRegistry.connectServer(server.config.id);
      const connector = mcpRegistry.getConnector(server.config.id);
      if (connector) {
        connectorRegistry.register(connector);
      }
      console.log(`[backend] MCP server "${server.config.name}" connected`);
    } catch (err) {
      console.warn(
        `[backend] MCP server "${server.config.name}" failed to connect:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
console.log(
  `[backend] MCP registry: ${mcpRegistry.getServers().length} server(s), ${mcpRegistry.getAllTools().length} tool(s)`,
);

// ---------- 5. Agent Registry ----------
const agentRegistry = new AgentRegistry();

// Perception agents
agentRegistry.register(new InputNormalizerAgent());
agentRegistry.register(new URLIntentParserAgent());

// Reasoning agents
agentRegistry.register(new IntentAgent());
agentRegistry.register(new ConfidenceScorerAgent());
agentRegistry.register(new InteractionSemanticsAgent());

// Context agents
agentRegistry.register(new MemoryRetrievalAgent());
agentRegistry.register(new ContextPlannerAgent());
agentRegistry.register(new ConnectorSelectionAgent());
agentRegistry.register(new DataRetrievalAgent());
agentRegistry.register(new PolicyGateAgent());

// UI agents
agentRegistry.register(new InboxSurfaceAgent());
agentRegistry.register(new CalendarSurfaceAgent());
agentRegistry.register(new DiscoverySurfaceAgent());
agentRegistry.register(new ApprovalSurfaceAgent());
agentRegistry.register(new ConnectionSurfaceAgent());
agentRegistry.register(new GenericDataSurfaceAgent());
agentRegistry.register(new LayoutComposerAgent());

// Safety agents
agentRegistry.register(new ProvenanceAnnotatorAgent());

// Execution agents
agentRegistry.register(new ActionExecutorAgent());

console.log(
  `[backend] Registered ${agentRegistry.getAll().length} agents: ${agentRegistry.getAll().map((a: { id: string }) => a.id).join(", ")}`,
);

// ---------- 6. Memory Store ----------
const memoryStore = new MemoryStore(db, bus);

// ---------- 7. Orchestrator ----------
const orchestrator = new Orchestrator(bus, agentRegistry, {
  modelProvider: modelRegistry,
  memoryStore,
  connectorRegistry,
  policyEngine,
  db,
});

// ---------- 8. Memory Update Pipeline ----------
const memoryPipeline = new MemoryUpdatePipeline(memoryStore, bus);
memoryPipeline.start();

// ---------- 8b. Observation Processor ----------
const observationProcessor = new ObservationProcessor(memoryStore, bus);
observationProcessor.start();

// ---------- 9. Background Task Scheduler ----------
const scheduler = new BackgroundTaskScheduler(bus, orchestrator, memoryStore);
for (const task of MVP_BACKGROUND_TASKS) {
  scheduler.register(task);
}
scheduler.start();
console.log(
  `[backend] Registered ${MVP_BACKGROUND_TASKS.length} background tasks: ${MVP_BACKGROUND_TASKS.map((t) => t.id).join(", ")}`,
);

// ---------- 10. Route user events to orchestrator ----------
const USER_EVENT_PATTERNS = [
  "user.*",
  "policy.approval.*",
];

/**
 * Passive observation event types that should NOT trigger the orchestration
 * pipeline. These are telemetry events processed by the ObservationProcessor
 * only (e.g. scroll-view fired by IntersectionObserver as the user scrolls).
 */
const PASSIVE_OBSERVATION_TYPES = new Set([
  "user.interaction.scroll-view",
]);

for (const pattern of USER_EVENT_PATTERNS) {
  bus.on(pattern, async (event: WaibEvent) => {
    // Skip passive observation events — they are handled by the
    // ObservationProcessor and should not re-trigger the full pipeline.
    if (PASSIVE_OBSERVATION_TYPES.has(event.type)) return;

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

// ---------- 11. Broadcast pipeline progress + composed surfaces ----------
bus.on("pipeline.phase.complete", (event: WaibEvent) => {
  const payload = event.payload as {
    phase: string;
    agents: Array<{ agentId: string; state: string }>;
  };
  const message: ServerMessage = {
    type: "status",
    payload: {
      phase: payload.phase,
      agents: payload.agents,
    },
  };
  broadcast(message);
});

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

// ---------- 12. Start HTTP/WebSocket server ----------
const server = startServer({ eventBus: bus, orchestrator, memoryStore, scheduler, mcpRegistry, connectorRegistry, db });

const PORT = Number(process.env.PORT) || 3001;
console.log(`[backend] WaibSpace backend started`);
console.log(`[backend] HTTP & WebSocket listening on port ${PORT}`);
console.log(`[backend] Started at ${new Date().toISOString()}`);
