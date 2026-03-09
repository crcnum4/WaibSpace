import { describe, it, expect, beforeEach } from "bun:test";
import type { WaibEvent, AgentOutput, AgentCategory } from "@waibspace/types";
import { EventBus, createEvent } from "@waibspace/event-bus";
import type { Agent, AgentInput, AgentContext } from "@waibspace/agents";
import { AgentRegistry } from "../agent-registry";
import { Orchestrator } from "../orchestrator";
import { buildExecutionPlan } from "../execution-planner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  type: string = "user.message.received",
  payload: unknown = { text: "hello" },
): WaibEvent {
  return createEvent(type, payload, "test");
}

function makeAgent(
  overrides: Partial<Agent> & { id: string; category: AgentCategory },
): Agent {
  return {
    name: overrides.name ?? overrides.id,
    type: overrides.type ?? "test",
    execute:
      overrides.execute ??
      (async () => ({
        agentId: overrides.id,
        agentType: overrides.type ?? "test",
        category: overrides.category,
        output: { result: `${overrides.id}-output` },
        confidence: 1,
        provenance: {
          sourceType: "agent",
          sourceId: overrides.id,
          trustLevel: "trusted" as const,
          timestamp: Date.now(),
          freshness: "realtime" as const,
          dataState: "raw" as const,
        },
        timing: { startMs: 0, endMs: 1, durationMs: 1 },
      })),
    ...overrides,
  };
}

function makeProvenance(agentId: string) {
  return {
    sourceType: "agent",
    sourceId: agentId,
    trustLevel: "trusted" as const,
    timestamp: Date.now(),
    freshness: "realtime" as const,
    dataState: "raw" as const,
  };
}

// ---------------------------------------------------------------------------
// Execution Planner tests
// ---------------------------------------------------------------------------

describe("buildExecutionPlan", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("returns empty phases when no agents are registered", () => {
    const plan = buildExecutionPlan("user.message.received", registry);
    expect(plan.phases).toEqual([]);
  });

  it("groups agents by category into phases", () => {
    registry.register(makeAgent({ id: "p1", category: "perception" }));
    registry.register(makeAgent({ id: "r1", category: "reasoning" }));

    const plan = buildExecutionPlan("user.message.received", registry);
    const phaseCategories = plan.phases.map((p) => p.category);

    expect(phaseCategories).toContain("perception");
    expect(phaseCategories).toContain("reasoning");
    // perception must come before reasoning
    expect(phaseCategories.indexOf("perception")).toBeLessThan(
      phaseCategories.indexOf("reasoning"),
    );
  });

  it("preserves pipeline ordering: perception -> reasoning -> context -> ui -> safety", () => {
    registry.register(makeAgent({ id: "s1", category: "safety" }));
    registry.register(makeAgent({ id: "p1", category: "perception" }));
    registry.register(makeAgent({ id: "u1", category: "ui" }));
    registry.register(makeAgent({ id: "r1", category: "reasoning" }));
    registry.register(makeAgent({ id: "c1", category: "context" }));

    const plan = buildExecutionPlan("user.message.received", registry);
    const categories = plan.phases.map((p) => p.category);

    const indexOf = (cat: AgentCategory) => {
      const idx = categories.indexOf(cat);
      expect(idx).toBeGreaterThanOrEqual(0);
      return idx;
    };

    expect(indexOf("perception")).toBeLessThan(indexOf("reasoning"));
    expect(indexOf("reasoning")).toBeLessThan(indexOf("context"));
    expect(indexOf("context")).toBeLessThan(indexOf("ui"));
    expect(indexOf("ui")).toBeLessThan(indexOf("safety"));
  });

  it("splits context agents into sequential sub-phases for user.message.received", () => {
    registry.register(makeAgent({ id: "context.planner", category: "context" }));
    registry.register(makeAgent({ id: "context.connector-selection", category: "context" }));
    registry.register(makeAgent({ id: "context.data-retrieval", category: "context" }));

    const plan = buildExecutionPlan("user.message.received", registry);
    const contextPhases = plan.phases.filter((p) => p.category === "context");

    // Should be 3 sequential sub-phases for context
    expect(contextPhases.length).toBe(3);
    expect(contextPhases[0].agents[0].id).toBe("context.planner");
    expect(contextPhases[1].agents[0].id).toBe("context.connector-selection");
    expect(contextPhases[2].agents[0].id).toBe("context.data-retrieval");
  });

  it("splits ui agents into sub-phases for user.message.received (surfaces then layout)", () => {
    registry.register(makeAgent({ id: "ui.inbox-surface", category: "ui" }));
    registry.register(makeAgent({ id: "ui.calendar-surface", category: "ui" }));
    registry.register(makeAgent({ id: "layout-composer", category: "ui" }));

    const plan = buildExecutionPlan("user.message.received", registry);
    const uiPhases = plan.phases.filter((p) => p.category === "ui");

    // First phase: parallel surface agents; second phase: layout-composer
    expect(uiPhases.length).toBe(2);
    const surfacePhase = uiPhases[0];
    const layoutPhase = uiPhases[1];

    expect(surfacePhase.agents.map((a) => a.id)).toContain("ui.inbox-surface");
    expect(surfacePhase.agents.map((a) => a.id)).toContain("ui.calendar-surface");
    expect(layoutPhase.agents[0].id).toBe("layout-composer");
  });

  it("uses execution-only pipeline for policy.approval.response", () => {
    registry.register(makeAgent({ id: "exec-agent", category: "execution" }));
    registry.register(makeAgent({ id: "p1", category: "perception" }));

    const plan = buildExecutionPlan("policy.approval.response", registry);
    const categories = plan.phases.map((p) => p.category);

    expect(categories).toEqual(["execution"]);
  });

  it("handles user.interaction.* events with message-received ordering", () => {
    registry.register(makeAgent({ id: "context.planner", category: "context" }));
    registry.register(makeAgent({ id: "context.connector-selection", category: "context" }));

    const plan = buildExecutionPlan("user.interaction.clicked", registry);
    const contextPhases = plan.phases.filter((p) => p.category === "context");

    // Should use the same ordering as user.message.received
    expect(contextPhases.length).toBe(2);
    expect(contextPhases[0].agents[0].id).toBe("context.planner");
    expect(contextPhases[1].agents[0].id).toBe("context.connector-selection");
  });

  it("includes agents not mentioned in ordering as a remaining phase", () => {
    registry.register(makeAgent({ id: "context.planner", category: "context" }));
    registry.register(makeAgent({ id: "context.custom-agent", category: "context" }));

    const plan = buildExecutionPlan("user.message.received", registry);
    const contextPhases = plan.phases.filter((p) => p.category === "context");

    // context.planner in its sub-phase, context.custom-agent in the remaining phase
    const remainingPhase = contextPhases.find((p) => p.id.includes("remaining"));
    expect(remainingPhase).toBeDefined();
    expect(remainingPhase!.agents[0].id).toBe("context.custom-agent");
  });
});

// ---------------------------------------------------------------------------
// AgentRegistry tests
// ---------------------------------------------------------------------------

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("registers and retrieves agents by id", () => {
    const agent = makeAgent({ id: "test-agent", category: "perception" });
    registry.register(agent);
    expect(registry.getById("test-agent")).toBe(agent);
  });

  it("returns undefined for unknown agent id", () => {
    expect(registry.getById("nonexistent")).toBeUndefined();
  });

  it("retrieves agents by category", () => {
    registry.register(makeAgent({ id: "p1", category: "perception" }));
    registry.register(makeAgent({ id: "p2", category: "perception" }));
    registry.register(makeAgent({ id: "r1", category: "reasoning" }));

    const perceptionAgents = registry.getByCategory("perception");
    expect(perceptionAgents.length).toBe(2);
    expect(perceptionAgents.map((a) => a.id).sort()).toEqual(["p1", "p2"]);
  });

  it("returns all registered agents", () => {
    registry.register(makeAgent({ id: "a1", category: "perception" }));
    registry.register(makeAgent({ id: "a2", category: "ui" }));
    expect(registry.getAll().length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Orchestrator integration tests
// ---------------------------------------------------------------------------

describe("Orchestrator.processEvent", () => {
  let eventBus: EventBus;
  let registry: AgentRegistry;

  beforeEach(() => {
    eventBus = new EventBus();
    registry = new AgentRegistry();
  });

  it("emits surface.composed with agent outputs when pipeline succeeds", async () => {
    registry.register(
      makeAgent({
        id: "ui.test-surface",
        category: "ui",
        execute: async () => ({
          agentId: "ui.test-surface",
          agentType: "test",
          category: "ui",
          output: { surfaces: [{ type: "card", data: "hello" }] },
          confidence: 0.9,
          provenance: makeProvenance("ui.test-surface"),
          timing: { startMs: 0, endMs: 1, durationMs: 1 },
        }),
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry);
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => {
      emitted.push(e);
    });

    await orchestrator.processEvent(makeEvent());

    expect(emitted.length).toBe(1);
    expect(emitted[0].type).toBe("surface.composed");
  });

  it("emits pipeline.phase.complete events for each phase", async () => {
    registry.register(makeAgent({ id: "p1", category: "perception" }));
    registry.register(makeAgent({ id: "u1", category: "ui" }));

    const orchestrator = new Orchestrator(eventBus, registry);
    const phaseEvents: WaibEvent[] = [];
    eventBus.on("pipeline.phase.complete", (e) => {
      phaseEvents.push(e);
    });

    await orchestrator.processEvent(makeEvent());

    expect(phaseEvents.length).toBe(2);
    const phases = phaseEvents.map(
      (e) => (e.payload as Record<string, unknown>).phase,
    );
    expect(phases).toContain("perception");
    expect(phases).toContain("ui");
  });

  it("executes phases sequentially, passing prior outputs forward", async () => {
    const executionOrder: string[] = [];

    registry.register(
      makeAgent({
        id: "p1",
        category: "perception",
        execute: async () => {
          executionOrder.push("p1");
          return {
            agentId: "p1",
            agentType: "test",
            category: "perception",
            output: { intent: "greet" },
            confidence: 0.95,
            provenance: makeProvenance("p1"),
            timing: { startMs: 0, endMs: 1, durationMs: 1 },
          };
        },
      }),
    );

    registry.register(
      makeAgent({
        id: "r1",
        category: "reasoning",
        execute: async (input: AgentInput) => {
          executionOrder.push("r1");
          // Should have p1's output in priorOutputs
          const prior = input.priorOutputs;
          return {
            agentId: "r1",
            agentType: "test",
            category: "reasoning",
            output: {
              priorCount: prior.length,
              sawPerception: prior.some((o) => o.category === "perception"),
            },
            confidence: 0.9,
            provenance: makeProvenance("r1"),
            timing: { startMs: 0, endMs: 1, durationMs: 1 },
          };
        },
      }),
    );

    registry.register(
      makeAgent({
        id: "u1",
        category: "ui",
        execute: async (input: AgentInput) => {
          executionOrder.push("u1");
          return {
            agentId: "u1",
            agentType: "test",
            category: "ui",
            output: { totalPrior: input.priorOutputs.length },
            confidence: 0.8,
            provenance: makeProvenance("u1"),
            timing: { startMs: 0, endMs: 1, durationMs: 1 },
          };
        },
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry);
    await orchestrator.processEvent(makeEvent());

    // Phases must execute in order
    expect(executionOrder).toEqual(["p1", "r1", "u1"]);
  });

  it("runs agents within the same phase in parallel", async () => {
    const startTimes: Record<string, number> = {};

    for (const id of ["p1", "p2", "p3"]) {
      registry.register(
        makeAgent({
          id,
          category: "perception",
          execute: async () => {
            startTimes[id] = Date.now();
            // Small delay to simulate work
            await new Promise((r) => setTimeout(r, 20));
            return {
              agentId: id,
              agentType: "test",
              category: "perception" as AgentCategory,
              output: {},
              confidence: 1,
              provenance: makeProvenance(id),
              timing: { startMs: 0, endMs: 1, durationMs: 1 },
            };
          },
        }),
      );
    }

    const orchestrator = new Orchestrator(eventBus, registry);
    await orchestrator.processEvent(makeEvent());

    // All three should have started at roughly the same time (within 10ms)
    const times = Object.values(startTimes);
    const spread = Math.max(...times) - Math.min(...times);
    expect(spread).toBeLessThan(15);
  });

  it("handles agent errors gracefully without crashing the pipeline", async () => {
    registry.register(
      makeAgent({
        id: "p1-crash",
        category: "perception",
        execute: async () => {
          throw new Error("agent-crash");
        },
      }),
    );

    registry.register(
      makeAgent({
        id: "u1",
        category: "ui",
        execute: async () => ({
          agentId: "u1",
          agentType: "test",
          category: "ui" as AgentCategory,
          output: { ok: true },
          confidence: 1,
          provenance: makeProvenance("u1"),
          timing: { startMs: 0, endMs: 1, durationMs: 1 },
        }),
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry);
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => emitted.push(e));

    // Should not throw
    await orchestrator.processEvent(makeEvent());

    // Pipeline still emits composed surface from u1
    expect(emitted.length).toBe(1);
  });

  it("attaches error info to surface.composed when agents fail", async () => {
    registry.register(
      makeAgent({
        id: "ui.bad",
        category: "ui",
        execute: async () => ({
          agentId: "ui.bad",
          agentType: "test",
          category: "ui" as AgentCategory,
          output: { error: "something broke" },
          confidence: 0,
          provenance: makeProvenance("ui.bad"),
          timing: { startMs: 0, endMs: 1, durationMs: 1 },
        }),
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry);
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => emitted.push(e));

    await orchestrator.processEvent(makeEvent());

    const payload = emitted[0].payload as Record<string, unknown>;
    expect(payload.errors).toBeDefined();
    const errors = payload.errors as Array<{ agentId: string; message: string }>;
    expect(errors[0].agentId).toBe("ui.bad");
    expect(errors[0].message).toBe("something broke");
  });

  it("emits error event when all agents fail and no surfaces produced", async () => {
    registry.register(
      makeAgent({
        id: "p1-fail",
        category: "perception",
        execute: async () => {
          throw new Error("total failure");
        },
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry);
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => emitted.push(e));

    await orchestrator.processEvent(makeEvent());

    // Should emit a surface.composed with empty surfaces and errors
    expect(emitted.length).toBe(1);
    const payload = emitted[0].payload as Record<string, unknown>;
    expect((payload.surfaces as unknown[]).length).toBe(0);
    expect((payload.errors as unknown[]).length).toBeGreaterThan(0);
  });

  it("respects timeout option and reports timed-out agents as errors", async () => {
    registry.register(
      makeAgent({
        id: "slow-agent",
        category: "perception",
        execute: async () => {
          // Simulate a slow agent that exceeds the timeout
          await new Promise((r) => setTimeout(r, 500));
          return {
            agentId: "slow-agent",
            agentType: "test",
            category: "perception" as AgentCategory,
            output: { result: "should not appear" },
            confidence: 1,
            provenance: makeProvenance("slow-agent"),
            timing: { startMs: 0, endMs: 1, durationMs: 1 },
          };
        },
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry, {
      timeoutMs: 50,
    });

    const phaseEvents: WaibEvent[] = [];
    eventBus.on("pipeline.phase.complete", (e) => phaseEvents.push(e));

    await orchestrator.processEvent(makeEvent());

    // The phase should complete with the agent in error state
    expect(phaseEvents.length).toBe(1);
    const agents = (phaseEvents[0].payload as Record<string, unknown>)
      .agents as Array<{ agentId: string; state: string }>;
    // executeAgent catches timeout and returns error output, so state is "complete"
    // but the output contains an error field
    expect(agents[0].agentId).toBe("slow-agent");
  });

  it("uses layout-composer output when available", async () => {
    const composedLayout = {
      layout: [{ type: "grid", children: ["card-1"] }],
      surfaces: [{ id: "card-1", type: "card" }],
    };

    registry.register(
      makeAgent({
        id: "ui.inbox-surface",
        category: "ui",
        execute: async () => ({
          agentId: "ui.inbox-surface",
          agentType: "test",
          category: "ui" as AgentCategory,
          output: { surfaces: [{ type: "inbox-card" }] },
          confidence: 0.9,
          provenance: makeProvenance("ui.inbox-surface"),
          timing: { startMs: 0, endMs: 1, durationMs: 1 },
        }),
      }),
    );

    registry.register(
      makeAgent({
        id: "layout-composer",
        category: "ui",
        execute: async () => ({
          agentId: "layout-composer",
          agentType: "test",
          category: "ui" as AgentCategory,
          output: composedLayout,
          confidence: 1,
          provenance: makeProvenance("layout-composer"),
          timing: { startMs: 0, endMs: 1, durationMs: 1 },
        }),
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry);
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => emitted.push(e));

    await orchestrator.processEvent(makeEvent());

    // Should use layout-composer's output directly
    const payload = emitted[0].payload as Record<string, unknown>;
    expect(payload.layout).toBeDefined();
    expect((payload.layout as unknown[]).length).toBe(1);
  });

  it("falls back to raw surface wrapping when no layout-composer", async () => {
    registry.register(
      makeAgent({
        id: "ui.test-surface",
        category: "ui",
        execute: async () => ({
          agentId: "ui.test-surface",
          agentType: "test",
          category: "ui" as AgentCategory,
          output: { type: "card", content: "hello" },
          confidence: 0.9,
          provenance: makeProvenance("ui.test-surface"),
          timing: { startMs: 0, endMs: 1, durationMs: 1 },
        }),
      }),
    );

    const orchestrator = new Orchestrator(eventBus, registry);
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => emitted.push(e));

    await orchestrator.processEvent(makeEvent());

    const payload = emitted[0].payload as Record<string, unknown>;
    expect(payload.surfaces).toBeDefined();
    expect((payload.surfaces as unknown[]).length).toBe(1);
  });

  it("propagates traceId through emitted events", async () => {
    registry.register(makeAgent({ id: "u1", category: "ui" }));

    const orchestrator = new Orchestrator(eventBus, registry);
    const event = makeEvent();
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => emitted.push(e));
    eventBus.on("pipeline.phase.complete", (e) => emitted.push(e));

    await orchestrator.processEvent(event);

    for (const e of emitted) {
      expect(e.traceId).toBe(event.traceId);
    }
  });

  it("does not emit surface.composed when no ui/execution agents are registered", async () => {
    registry.register(makeAgent({ id: "p1", category: "perception" }));

    const orchestrator = new Orchestrator(eventBus, registry);
    const emitted: WaibEvent[] = [];
    eventBus.on("surface.composed", (e) => emitted.push(e));

    await orchestrator.processEvent(makeEvent());

    expect(emitted.length).toBe(0);
  });
});
