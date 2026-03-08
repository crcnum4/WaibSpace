import type { WaibEvent, AgentOutput, AgentCategory } from "@waibspace/types";
import { EventBus, createEvent } from "@waibspace/event-bus";
import { executeAgent } from "@waibspace/agents";
import type { ModelProviderRegistry } from "@waibspace/model-provider";
import type { MemoryStore } from "@waibspace/memory";
import type { ConnectorRegistry } from "@waibspace/connectors";
import type { PolicyEngine } from "@waibspace/policy";
import { AgentRegistry } from "./agent-registry";
import { buildExecutionPlan } from "./execution-planner";
import { createPipelineTrace, logTrace } from "./trace";

export interface OrchestratorOptions {
  timeoutMs?: number;
  modelProvider?: ModelProviderRegistry;
  memoryStore?: MemoryStore;
  connectorRegistry?: ConnectorRegistry;
  policyEngine?: PolicyEngine;
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
      startMs: number;
      endMs: number;
      outputs: AgentOutput[];
    }> = [];

    for (const phase of plan.phases) {
      const phaseStartMs = Date.now();
      const input = { event, priorOutputs };
      const context = {
        traceId: event.traceId,
        modelProvider: this.options?.modelProvider,
        config: {
          ...(this.options?.memoryStore
            ? { memoryStore: this.options.memoryStore }
            : {}),
          ...(this.options?.connectorRegistry
            ? { connectorRegistry: this.options.connectorRegistry }
            : {}),
          ...(this.options?.policyEngine
            ? { policyEngine: this.options.policyEngine }
            : {}),
        },
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

      const phaseEndMs = Date.now();
      phaseResults.push({
        category: phase.category,
        startMs: phaseStartMs,
        endMs: phaseEndMs,
        outputs: phaseOutputs,
      });

      // Accumulate outputs for the next phase
      priorOutputs = [...priorOutputs, ...phaseOutputs];
    }

    const endMs = Date.now();

    // If LayoutComposerAgent produced a ComposedLayout, use that directly.
    // Otherwise fall back to raw surface outputs.
    const surfaceOutputs = priorOutputs.filter(
      (o) => o.category === "ui" || o.category === "execution",
    );
    if (surfaceOutputs.length > 0) {
      // Check if LayoutComposerAgent produced a ComposedLayout
      const layoutOutput = surfaceOutputs.find(
        (o) => o.agentId === "layout-composer" && o.output,
      );

      let composedPayload: unknown;
      if (layoutOutput) {
        // LayoutComposerAgent output is already a ComposedLayout
        composedPayload = layoutOutput.output;
      } else {
        // Fallback: wrap raw outputs
        composedPayload = { surfaces: surfaceOutputs.map((o) => o.output) };
      }

      const composedEvent = createEvent(
        "surface.composed",
        composedPayload,
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
