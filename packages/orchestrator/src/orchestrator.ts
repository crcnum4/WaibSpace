import type { WaibEvent, AgentOutput, AgentCategory } from "@waibspace/types";
import { EventBus, createEvent } from "@waibspace/event-bus";
import { executeAgent } from "@waibspace/agents";
import type { ModelProviderRegistry } from "@waibspace/model-provider";
import { AgentRegistry } from "./agent-registry";
import { buildExecutionPlan } from "./execution-planner";
import { createPipelineTrace, logTrace } from "./trace";

export interface OrchestratorOptions {
  timeoutMs?: number;
  modelProvider?: ModelProviderRegistry;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class Orchestrator {
  constructor(
    private eventBus: EventBus,
    private registry: AgentRegistry,
    private options?: OrchestratorOptions,
  ) {}

  async processEvent(event: WaibEvent): Promise<void> {
    const startMs = Date.now();
    const plan = buildExecutionPlan(event.type, this.registry);
    const timeoutMs = this.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    let priorOutputs: AgentOutput[] = [];
    const phaseResults: Array<{
      category: AgentCategory;
      outputs: AgentOutput[];
    }> = [];

    for (const phase of plan.phases) {
      const input = { event, priorOutputs };
      const context = {
        traceId: event.traceId,
        modelProvider: this.options?.modelProvider,
      };

      // Execute all agents in this phase in parallel
      const results = await Promise.allSettled(
        phase.agents.map((agent) =>
          executeAgent(agent, input, context, { timeoutMs }),
        ),
      );

      const phaseOutputs: AgentOutput[] = results
        .filter(
          (r): r is PromiseFulfilledResult<AgentOutput> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);

      phaseResults.push({ category: phase.category, outputs: phaseOutputs });

      // Accumulate outputs for the next phase
      priorOutputs = [...priorOutputs, ...phaseOutputs];
    }

    const endMs = Date.now();

    // If any UI agent outputs exist, emit a surface.composed event
    const uiOutputs = priorOutputs.filter((o) => o.category === "ui");
    if (uiOutputs.length > 0) {
      const composedEvent = createEvent(
        "surface.composed",
        { surfaces: uiOutputs.map((o) => o.output) },
        "orchestrator",
        event.traceId,
      );
      this.eventBus.emit(composedEvent);
    }

    // Log trace summary
    const trace = createPipelineTrace(
      event.traceId,
      event.type,
      startMs,
      endMs,
      phaseResults,
    );
    logTrace(trace);
  }
}
