import type { WaibEvent, AgentOutput, AgentCategory } from "@waibspace/types";
import { EventBus, createEvent } from "@waibspace/event-bus";
import { executeAgent } from "@waibspace/agents";
import type { ModelProviderRegistry } from "@waibspace/model-provider";
import type { MemoryStore } from "@waibspace/memory";
import type { ConnectorRegistry } from "@waibspace/connectors";
import type { PolicyEngine } from "@waibspace/policy";
import type { WaibDatabase } from "@waibspace/db";
import { AgentRegistry } from "./agent-registry";
import { buildExecutionPlan } from "./execution-planner";
import { createPipelineTrace, logTrace } from "./trace";

export interface OrchestratorOptions {
  timeoutMs?: number;
  modelProvider?: ModelProviderRegistry;
  memoryStore?: MemoryStore;
  connectorRegistry?: ConnectorRegistry;
  policyEngine?: PolicyEngine;
  db?: WaibDatabase;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class Orchestrator {
  constructor(
    private eventBus: EventBus,
    private registry: AgentRegistry,
    private options?: OrchestratorOptions,
  ) {}

  private logToDb(
    eventType: string,
    source: string,
    traceId: string,
    payload: unknown,
    level: "info" | "warn" | "error" = "info",
  ): void {
    try {
      this.options?.db?.logEvent({
        id: `${traceId}-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        eventType,
        source,
        traceId,
        payload,
        level,
        createdAt: Date.now(),
      });
    } catch {
      // DB logging should never break the pipeline
    }
  }

  async processEvent(event: WaibEvent): Promise<void> {
    const startMs = Date.now();
    const plan = buildExecutionPlan(event.type, this.registry);
    const timeoutMs = this.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const traceId = event.traceId;

    this.logToDb("pipeline.start", "orchestrator", traceId, {
      eventType: event.type,
      payload: event.payload,
      phases: plan.phases.map((p) => ({
        category: p.category,
        agents: p.agents.map((a) => a.id),
      })),
    });

    let priorOutputs: AgentOutput[] = [];
    const phaseResults: Array<{
      category: AgentCategory;
      startMs: number;
      endMs: number;
      outputs: AgentOutput[];
    }> = [];
    const errors: Array<{ agentId: string; error: string; phase: string }> = [];

    for (const phase of plan.phases) {
      const phaseStartMs = Date.now();
      const input = { event, priorOutputs };
      const context = {
        traceId,
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

      // Execute all agents in this phase in parallel with isolation
      const results = await Promise.allSettled(
        phase.agents.map((agent) =>
          executeAgent(agent, input, context, { timeoutMs }),
        ),
      );

      const phaseOutputs: AgentOutput[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const agent = phase.agents[i];

        if (result.status === "fulfilled") {
          phaseOutputs.push(result.value);

          // Track agent-level errors (returned as output.error)
          const output = result.value.output as Record<string, unknown> | undefined;
          if (output && typeof output === "object" && "error" in output) {
            const errorMsg = String(output.error);
            errors.push({
              agentId: agent.id,
              error: errorMsg,
              phase: phase.category,
            });
            this.logToDb("agent.error", agent.id, traceId, {
              phase: phase.category,
              error: errorMsg,
              durationMs: result.value.timing?.durationMs,
            }, "error");
            console.error(
              `[Orchestrator] [trace:${traceId}] Agent ${agent.id} returned error in phase "${phase.category}": ${errorMsg}`,
            );
          } else {
            // Log successful agent completion with output summary
            // Include full output for context agents (planner, connector-selection, data-retrieval)
            const isContextAgent = phase.category === "context";
            this.logToDb("agent.complete", agent.id, traceId, {
              phase: phase.category,
              confidence: result.value.confidence,
              durationMs: result.value.timing?.durationMs,
              hasOutput: result.value.output != null,
              outputKeys: output && typeof output === "object" ? Object.keys(output) : [],
              ...(isContextAgent ? { output: result.value.output } : {}),
            }, "info");
          }
        } else {
          // Agent threw an unhandled rejection (should be rare since executeAgent catches)
          const errorMsg =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          errors.push({
            agentId: agent.id,
            error: errorMsg,
            phase: phase.category,
          });
          this.logToDb("agent.crash", agent.id, traceId, {
            phase: phase.category,
            error: errorMsg,
          }, "error");
          console.error(
            `[Orchestrator] [trace:${traceId}] Agent ${agent.id} crashed in phase "${phase.category}": ${errorMsg}`,
          );
        }
      }

      const phaseEndMs = Date.now();
      phaseResults.push({
        category: phase.category,
        startMs: phaseStartMs,
        endMs: phaseEndMs,
        outputs: phaseOutputs,
      });

      // Accumulate outputs for the next phase
      priorOutputs = [...priorOutputs, ...phaseOutputs];

      // Emit phase progress so the frontend can show incremental loading state
      const agentStatuses = phase.agents.map((agent, i) => {
        const result = results[i];
        return {
          agentId: agent.id,
          state: result.status === "fulfilled"
            ? ("complete" as const)
            : ("error" as const),
        };
      });
      const progressEvent = createEvent(
        "pipeline.phase.complete",
        {
          phase: phase.category,
          agents: agentStatuses,
        },
        "orchestrator",
        traceId,
      );
      this.eventBus.emit(progressEvent);
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

      // Attach error info so the frontend can display partial-failure indicators
      if (errors.length > 0) {
        (composedPayload as Record<string, unknown>).errors = errors.map(
          (e) => ({
            agentId: e.agentId,
            message: e.error,
            phase: e.phase,
          }),
        );
      }

      const composedEvent = createEvent(
        "surface.composed",
        composedPayload,
        "orchestrator",
        traceId,
      );
      this.eventBus.emit(composedEvent);
    } else if (errors.length > 0) {
      // No surfaces produced but there were errors - emit an error event
      // so the frontend knows something went wrong
      console.error(
        `[Orchestrator] [trace:${traceId}] Pipeline produced no surfaces. ${errors.length} error(s) occurred.`,
      );
      const errorEvent = createEvent(
        "surface.composed",
        {
          surfaces: [],
          layout: [],
          timestamp: Date.now(),
          traceId,
          errors: errors.map((e) => ({
            agentId: e.agentId,
            message: e.error,
            phase: e.phase,
          })),
        },
        "orchestrator",
        traceId,
      );
      this.eventBus.emit(errorEvent);
    }

    // Log trace summary
    const trace = createPipelineTrace(
      traceId,
      event.type,
      startMs,
      endMs,
      phaseResults,
    );
    logTrace(trace);

    this.logToDb("pipeline.complete", "orchestrator", traceId, {
      eventType: event.type,
      durationMs: endMs - startMs,
      totalErrors: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      surfaceCount: surfaceOutputs.length,
    }, errors.length > 0 ? "warn" : "info");

    if (errors.length > 0) {
      console.warn(
        `[Orchestrator] [trace:${traceId}] Completed with ${errors.length} error(s): ${errors.map((e) => e.agentId).join(", ")}`,
      );
    }
  }
}
