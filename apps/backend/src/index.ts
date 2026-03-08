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
  LayoutComposerAgent,
  // Safety agents
  ProvenanceAnnotatorAgent,
  // Execution agents
  ActionExecutorAgent,
} from "@waibspace/agents";
import {
  ConnectorRegistry,
  GmailConnector,
  GoogleCalendarConnector,
  WebFetchConnector,
} from "@waibspace/connectors";
import { PolicyEngine, DEFAULT_POLICY_RULES } from "@waibspace/policy";
import {
  ModelProviderRegistry,
  AnthropicProvider,
} from "@waibspace/model-provider";
import { MemoryStore, MemoryUpdatePipeline } from "@waibspace/memory";
import { BackgroundTaskScheduler, MVP_BACKGROUND_TASKS } from "./background";
import { startServer } from "./server";
import { broadcast } from "./ws";

// ---------- 1. Event Bus ----------
const bus = new EventBus();

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

// Gmail connector — connect() handles missing credentials gracefully
const gmailConnector = new GmailConnector();
await gmailConnector.connect();
connectorRegistry.register(gmailConnector);
console.log(
  `[backend] Gmail connector registered (${gmailConnector.isConnected() ? "connected" : "not configured"})`,
);

// Google Calendar connector — gracefully handles missing credentials
const calClientId = process.env.GCAL_CLIENT_ID ?? "";
const calClientSecret = process.env.GCAL_CLIENT_SECRET ?? "";
const calRefreshToken = process.env.GCAL_REFRESH_TOKEN ?? "";

if (calClientId && calClientSecret && calRefreshToken) {
  const calendarConnector = new GoogleCalendarConnector({
    clientId: calClientId,
    clientSecret: calClientSecret,
    redirectUri: process.env.GCAL_REDIRECT_URI ?? "http://localhost:3001/oauth/callback",
    refreshToken: calRefreshToken,
  });
  try {
    await calendarConnector.connect();
    connectorRegistry.register(calendarConnector);
    console.log("[backend] Google Calendar connector registered");
  } catch (err) {
    console.warn(
      "[backend] Google Calendar connector not available:",
      err instanceof Error ? err.message : err,
    );
    connectorRegistry.register(calendarConnector);
  }
} else {
  console.warn("[backend] Google Calendar connector not configured (missing GCAL_* env vars)");
}

// WebFetch connector — always available (no credentials needed)
const webFetchConnector = new WebFetchConnector("web-fetch", "Web Fetch");
await webFetchConnector.connect();
connectorRegistry.register(webFetchConnector);
console.log("[backend] WebFetch connector registered");

console.log(
  `[backend] Connector registry: ${connectorRegistry.getAll().map((c: { id: string; isConnected: () => boolean }) => `${c.id}(${c.isConnected() ? "connected" : "disconnected"})`).join(", ")}`,
);

// ---------- 4. Policy Engine ----------
const policyEngine = new PolicyEngine(DEFAULT_POLICY_RULES);
console.log(`[backend] Policy engine initialized with ${policyEngine.getRules().length} rules`);

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
agentRegistry.register(new LayoutComposerAgent());

// Safety agents
agentRegistry.register(new ProvenanceAnnotatorAgent());

// Execution agents
agentRegistry.register(new ActionExecutorAgent());

console.log(
  `[backend] Registered ${agentRegistry.getAll().length} agents: ${agentRegistry.getAll().map((a: { id: string }) => a.id).join(", ")}`,
);

// ---------- 6. Memory Store ----------
const memoryStore = new MemoryStore("./data/memory.json", bus);
await memoryStore.load();
memoryStore.startAutoSave();

// ---------- 7. Orchestrator ----------
const orchestrator = new Orchestrator(bus, agentRegistry, {
  modelProvider: modelRegistry,
  memoryStore,
  connectorRegistry,
  policyEngine,
});

// ---------- 8. Memory Update Pipeline ----------
const memoryPipeline = new MemoryUpdatePipeline(memoryStore, bus);
memoryPipeline.start();

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

// ---------- 11. Broadcast composed surfaces to WebSocket clients ----------
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
const server = startServer({ eventBus: bus, orchestrator, memoryStore, scheduler });

const PORT = Number(process.env.PORT) || 3001;
console.log(`[backend] WaibSpace backend started`);
console.log(`[backend] HTTP & WebSocket listening on port ${PORT}`);
console.log(`[backend] Started at ${new Date().toISOString()}`);
