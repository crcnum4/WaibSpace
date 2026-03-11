import { EventBus } from "@waibspace/event-bus";
import type { WaibEvent } from "@waibspace/types";
import { createLogger } from "@waibspace/logger";

import type { ServerMessage, ComposedLayout } from "@waibspace/ui-renderer-contract";
import { Orchestrator, AgentRegistry, InMemoryPendingActionStore, AgentSpawner } from "@waibspace/orchestrator";
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
  ConversationContextAgent,
  PolicyGateAgent,
  BehavioralPreferenceAgent,
  // UI agents
  InboxSurfaceAgent,
  CalendarSurfaceAgent,
  DiscoverySurfaceAgent,
  ApprovalSurfaceAgent,
  ConnectionSurfaceAgent,
  GenericDataSurfaceAgent,
  SearchSurfaceAgent,
  LayoutComposerAgent,
  // Safety agents
  ProvenanceAnnotatorAgent,
  // Execution agents
  ActionExecutorAgent,
  // Triage agents
  DataTriageAgent,
  EmailTriageClassifier,
  TriageMemoryIntegrator,
  TriageFeedbackTracker,
  // Trust tracking
  ApprovalTracker,
  UserRulesManager,
  EscalationEngine,
  // Context agents
  MemoryRecallAgent,
} from "@waibspace/agents";
import {
  ConnectorRegistry,
  WebFetchConnector,
  MCPServerRegistry,
  MockGmailConnector,
  MockCalendarConnector,
} from "@waibspace/connectors";
import { PolicyEngine, DEFAULT_POLICY_RULES } from "@waibspace/policy";
import {
  ModelProviderRegistry,
  AnthropicProvider,
} from "@waibspace/model-provider";
import { MemoryStore, MemoryUpdatePipeline, ObservationProcessor, ConversationContextStore, EngagementTracker, BehavioralTracker, BehavioralModel, ShortTermMemoryManager, MidTermMemory, LongTermMemory } from "@waibspace/memory";
import { WaibDatabase } from "@waibspace/db";
import { BackgroundTaskScheduler, MVP_BACKGROUND_TASKS } from "./background";
import { TaskScheduler } from "./scheduler";
import { startServer } from "./server";
import { broadcast } from "./ws";
import { AlertEmitter } from "./alert-emitter";
import { AwayTracker } from "./away-tracker";

// ---------- 1. Event Bus ----------
const bus = new EventBus();
const log = createLogger("backend");

// ---------- 1b. Database ----------
const db = new WaibDatabase("./data/waibspace.db");
log.info("SQLite database initialized");

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
log.info("WebFetch connector registered");

// Mock connectors — use fixture data when MOCK_CONNECTORS is enabled
// Real email/calendar connections are handled via MCP servers (Settings → Marketplace)
if (process.env.MOCK_CONNECTORS === "true") {
  const mockGmail = new MockGmailConnector();
  await mockGmail.connect();
  connectorRegistry.register(mockGmail);
  log.info("MockGmailConnector registered", { mock: true });

  const mockCalendar = new MockCalendarConnector();
  await mockCalendar.connect();
  connectorRegistry.register(mockCalendar);
  log.info("MockCalendarConnector registered", { mock: true });
}

// ---------- 4. Policy Engine ----------
const policyEngine = new PolicyEngine(DEFAULT_POLICY_RULES);
log.info("Policy engine initialized", { ruleCount: policyEngine.getRules().length });

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
      log.info("MCP server connected", { serverName: server.config.name });
    } catch (err) {
      log.warn("MCP server failed to connect", {
        serverName: server.config.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
log.info("MCP registry loaded", {
  serverCount: mcpRegistry.getServers().length,
  toolCount: mcpRegistry.getAllTools().length,
});

// Start periodic health checks for connected MCP servers (every 30s)
mcpRegistry.startHealthChecks(30_000);

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
agentRegistry.register(new ConversationContextAgent());
agentRegistry.register(new ContextPlannerAgent());
agentRegistry.register(new ConnectorSelectionAgent());
agentRegistry.register(new DataRetrievalAgent());
agentRegistry.register(new PolicyGateAgent());
agentRegistry.register(new BehavioralPreferenceAgent());
agentRegistry.register(new MemoryRecallAgent());

// Triage agents
const dataTriageAgent = new DataTriageAgent();
dataTriageAgent.registerClassifier(new EmailTriageClassifier());
agentRegistry.register(dataTriageAgent);

// UI agents
agentRegistry.register(new InboxSurfaceAgent());
agentRegistry.register(new CalendarSurfaceAgent());
agentRegistry.register(new DiscoverySurfaceAgent());
agentRegistry.register(new ApprovalSurfaceAgent());
agentRegistry.register(new ConnectionSurfaceAgent());
agentRegistry.register(new GenericDataSurfaceAgent());
agentRegistry.register(new SearchSurfaceAgent());
agentRegistry.register(new LayoutComposerAgent());

// Safety agents
agentRegistry.register(new ProvenanceAnnotatorAgent());

// Execution agents
agentRegistry.register(new ActionExecutorAgent());

log.info("Agent registry initialized", {
  agentCount: agentRegistry.getAll().length,
  agents: agentRegistry.getAll().map((a: { id: string }) => a.id),
});

// ---------- 6. Memory Store ----------
const memoryStore = new MemoryStore(db, bus);

// ---------- 6. Three-Tier Memory ----------
const shortTermMemoryManager = new ShortTermMemoryManager();
shortTermMemoryManager.startAutoCleanup();
const midTermMemory = new MidTermMemory(db);
const longTermMemory = new LongTermMemory(db);
log.info("Three-tier memory initialized (short/mid/long-term)");

// ---------- 6. Triage Memory Integration ----------
const triageMemoryIntegrator = new TriageMemoryIntegrator(midTermMemory, longTermMemory);
const triageFeedbackTracker = new TriageFeedbackTracker(midTermMemory);
log.info("Triage memory integrator and feedback tracker initialized");

// ---------- 6. Approval Tracker ----------
const approvalTracker = new ApprovalTracker(midTermMemory);
log.info("Approval tracker initialized");

// ---------- 6. User Trust Rules ----------
const userRulesManager = new UserRulesManager(longTermMemory, midTermMemory);
log.info("User trust rules manager initialized");

// ---------- 6. Escalation Engine ----------
const escalationEngine = new EscalationEngine(approvalTracker, midTermMemory);
log.info("Escalation engine initialized", {
  activeRules: escalationEngine.getActiveRules().length,
});

// ---------- 6a. Engagement Tracker ----------
const engagementTracker = new EngagementTracker(memoryStore);
log.info("Engagement tracker initialized");

// ---------- 6b. Conversation Context Store ----------
const conversationContextStore = new ConversationContextStore();
conversationContextStore.startCleanup();
log.info("Conversation context store initialized");

// ---------- 6b. Pending Action Store ----------
const pendingActionStore = new InMemoryPendingActionStore();
log.info("Pending action store initialized");

// ---------- 6c. Agent Spawner ----------
const agentSpawner = new AgentSpawner(bus, { maxConcurrent: 5 });
log.info("Agent spawner initialized", { maxConcurrent: 5 });

// ---------- 7. Orchestrator ----------
const orchestrator = new Orchestrator(bus, agentRegistry, {
  modelProvider: modelRegistry,
  memoryStore,
  conversationContextStore,
  connectorRegistry,
  policyEngine,
  pendingActionStore,
  engagementTracker,
  db,
  shortTermMemoryManager,
  midTermMemory,
  longTermMemory,
  triageMemoryIntegrator,
  triageFeedbackTracker,
  approvalTracker,
  userRulesManager,
  escalationEngine,
  agentSpawner,
});

// ---------- 7b. Alert Emitter ----------
const alertEmitter = new AlertEmitter(bus);

// Subscribe to triage results with high-urgency items and emit proactive alerts
bus.on("triage.high_urgency", (event: WaibEvent) => {
  const payload = event.payload as {
    triageItems: Array<{
      raw: unknown;
      triage: {
        itemId: string;
        urgency: string;
        category: string;
        reasoning?: string;
        suggestedAction?: string;
      };
    }>;
    connectorId: string;
  };
  alertEmitter.emitAlerts(payload.triageItems, payload.connectorId, event.traceId);

  // Record for away tracker
  awayTracker.recordBackgroundEvent({
    type: "triage.high_urgency",
    summary: `${payload.triageItems.length} high-urgency item(s) from ${payload.connectorId}`,
    connectorId: payload.connectorId,
  });
});
log.info("Alert emitter initialized");

// ---------- 7c. Away Tracker ----------
const awayTracker = new AwayTracker();
log.info("Away tracker initialized");

// ---------- 8. Memory Update Pipeline ----------
const memoryPipeline = new MemoryUpdatePipeline(memoryStore, bus);
memoryPipeline.start();

// ---------- 8b. Observation Processor ----------
const observationProcessor = new ObservationProcessor(memoryStore, bus);
observationProcessor.start();

// ---------- 8c. Engagement Tracking (interaction events -> engagement tracker) ----------
bus.on("user.interaction.*", (event: WaibEvent) => {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!payload) return;

  const surfaceType = (payload.surfaceType as string) || "";
  const surfaceId = (payload.surfaceId as string) || "";
  const interaction = (payload.interaction as string) || "";

  // Only track interactions with identified surfaces
  if (surfaceType && surfaceId) {
    engagementTracker.recordInteraction({
      surfaceType,
      surfaceId,
      interaction,
      timestamp: Date.now(),
    });
  }
});

// ---------- 8d. Behavioral Learning ----------
const behavioralTracker = new BehavioralTracker(memoryStore, bus);
behavioralTracker.start();

const behavioralModel = new BehavioralModel(memoryStore);

// Periodically refresh learned preferences (every 5 minutes)
setInterval(() => {
  behavioralModel.persistPreferences();
}, 5 * 60 * 1000);

log.info("Behavioral learning pipeline initialized");

// ---------- 9. Background Task Scheduler ----------
const scheduler = new BackgroundTaskScheduler(bus, orchestrator, memoryStore);
for (const task of MVP_BACKGROUND_TASKS) {
  scheduler.register(task);
}
scheduler.start();
log.info("Background tasks registered", {
  taskCount: MVP_BACKGROUND_TASKS.length,
  tasks: MVP_BACKGROUND_TASKS.map((t) => t.id),
});

// ---------- 9b. Connector Polling Scheduler ----------
const pollingScheduler = new TaskScheduler((event) => {
  const traceId = event.traceId;
  log.child({ traceId }).info("Polling event emitted", { eventType: event.type, payload: event.payload });
  orchestrator.processEvent(event).catch((err: unknown) => {
    const payload = event.payload as { connectorId?: string; operation?: string } | undefined;
    const taskId = payload ? `${payload.connectorId}:${payload.operation}` : "unknown";
    pollingScheduler.recordFailure(taskId);
    log.child({ traceId }).error("Poll event processing failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
});

// Register default polling tasks for connected services
pollingScheduler.register("mcp-gmail", "get_unseen_messages", 5 * 60 * 1000);      // Email: every 5 minutes
pollingScheduler.register("mcp-google-calendar", "get_events", 15 * 60 * 1000);    // Calendar: every 15 minutes
pollingScheduler.start();
log.info("Connector polling scheduler started", {
  tasks: pollingScheduler.status().map((t) => `${t.connectorId}:${t.operation}`),
});

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

    // Record user activity for away tracking
    awayTracker.recordActivity();

    // On user.message.received, check if user was away and inject summary
    if (event.type === "user.message.received") {
      const awaySummary = awayTracker.checkAndGetAwaySummary();
      if (awaySummary) {
        const duration = AwayTracker.formatDuration(awaySummary.durationMs);
        log.info("User returned after absence", {
          duration,
          eventCount: awaySummary.events.length,
        });
        // Inject away summary into the event payload for LayoutComposer
        const payload = event.payload as Record<string, unknown>;
        payload.awaySummary = {
          durationMs: awaySummary.durationMs,
          durationFormatted: duration,
          events: awaySummary.events,
        };
      }
    }

    const traceId = event.traceId;
    log.child({ traceId }).info("Routing event to orchestrator", { eventType: event.type });
    try {
      await orchestrator.processEvent(event);
    } catch (err) {
      log.child({ traceId }).error("Orchestrator error", {
        eventType: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
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
  log.child({ traceId: event.traceId }).debug("Broadcasting surface.composed to WebSocket clients");
  broadcast(message);
});

// ---------- 11b. Broadcast background task completion notifications ----------
bus.on("background.task.complete", (event: WaibEvent) => {
  const payload = event.payload as {
    taskId: string;
    taskName: string;
    success: boolean;
    durationMs: number;
    error?: string;
  };

  // Record for away tracker
  if (payload.success) {
    awayTracker.recordBackgroundEvent({
      type: "task.complete",
      summary: `Background task "${payload.taskName}" completed`,
    });
  }

  const message: ServerMessage = {
    type: "task.complete",
    payload,
  };
  log.child({ traceId: event.traceId }).info("Broadcasting task.complete", {
    taskId: payload.taskId,
    success: payload.success,
  });
  broadcast(message);
});

// ---------- 11c. Broadcast proactive alerts to WebSocket clients ----------
bus.on("briefing.alert", (event: WaibEvent) => {
  const payload = event.payload as {
    itemId: string;
    cardType: string;
    title: string;
    context: string;
    urgency: string;
    source: string;
    suggestedAction?: string;
    timestamp: number;
  };
  const message: ServerMessage = {
    type: "briefing.alert",
    payload,
  };
  log.child({ traceId: event.traceId }).info("Broadcasting briefing.alert", {
    itemId: payload.itemId,
    title: payload.title,
  });
  broadcast(message);
});

// ---------- 12. Start HTTP/WebSocket server ----------
const server = startServer({ eventBus: bus, orchestrator, memoryStore, scheduler, mcpRegistry, connectorRegistry, db, pendingActionStore });

const PORT = Number(process.env.PORT) || 3001;
log.info("WaibSpace backend started", { port: PORT });

// ---------- 13. Graceful Shutdown ----------
function handleShutdown(signal: string) {
  log.info("Shutting down", { signal });
  agentSpawner.shutdown();
  mcpRegistry.stopHealthChecks();
  scheduler.stop();
  pollingScheduler.stop();
  conversationContextStore.stopCleanup();
  shortTermMemoryManager.stopAutoCleanup();
  server.stop();
  log.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
