import type { AgentCategory, AgentOutput } from "@waibspace/types";
import { createLogger } from "@waibspace/logger";

const log = createLogger("pipeline-trace");

export interface PipelineTrace {
  traceId: string;
  eventType: string;
  startMs: number;
  endMs: number;
  phases: PhaseTrace[];
}

export interface PhaseTrace {
  category: AgentCategory;
  startMs: number;
  endMs: number;
  durationMs: number;
  agents: Array<{
    agentId: string;
    agentType: string;
    durationMs: number;
    status: "success" | "error" | "timeout";
    confidence: number;
  }>;
}

/**
 * Derive agent trace status from an AgentOutput.
 */
function getAgentStatus(output: AgentOutput): "success" | "error" | "timeout" {
  const payload = output.output as Record<string, unknown> | undefined;
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorMsg = String(payload.error);
    if (errorMsg.includes("timed out")) {
      return "timeout";
    }
    return "error";
  }
  return "success";
}

/**
 * Create a PipelineTrace from phase execution results.
 */
export function createPipelineTrace(
  traceId: string,
  eventType: string,
  startMs: number,
  endMs: number,
  phaseResults: Array<{
    category: AgentCategory;
    startMs: number;
    endMs: number;
    outputs: AgentOutput[];
  }>,
): PipelineTrace {
  return {
    traceId,
    eventType,
    startMs,
    endMs,
    phases: phaseResults.map((phase) => ({
      category: phase.category,
      startMs: phase.startMs,
      endMs: phase.endMs,
      durationMs: phase.endMs - phase.startMs,
      agents: phase.outputs.map((output) => ({
        agentId: output.agentId,
        agentType: output.agentType,
        durationMs: output.timing.durationMs,
        status: getAgentStatus(output),
        confidence: output.confidence,
      })),
    })),
  };
}

/**
 * Aggregate phase traces by category for the timing summary.
 */
function aggregateByCategory(
  phases: PhaseTrace[],
): Map<AgentCategory, { durationMs: number; agents: Array<{ agentId: string; durationMs: number }> }> {
  const categories = new Map<
    AgentCategory,
    { durationMs: number; agents: Array<{ agentId: string; durationMs: number }> }
  >();

  for (const phase of phases) {
    const existing = categories.get(phase.category);
    if (existing) {
      existing.durationMs += phase.durationMs;
      existing.agents.push(
        ...phase.agents.map((a) => ({ agentId: a.agentId, durationMs: a.durationMs })),
      );
    } else {
      categories.set(phase.category, {
        durationMs: phase.durationMs,
        agents: phase.agents.map((a) => ({ agentId: a.agentId, durationMs: a.durationMs })),
      });
    }
  }

  return categories;
}

/**
 * Log a pipeline trace summary to the console with per-category timing breakdown.
 *
 * Output format:
 *   [trace:xxx] Pipeline complete in 2340ms
 *     perception: 45ms (input-normalizer: 12ms, url-parser: 33ms)
 *     reasoning: 890ms (intent-agent: 850ms, confidence-scorer: 40ms)
 *     ...
 */
export function logTrace(trace: PipelineTrace): void {
  const totalDuration = trace.endMs - trace.startMs;
  const categories = aggregateByCategory(trace.phases);
  const traceLog = log.child({ traceId: trace.traceId });

  const breakdown: Record<string, { durationMs: number; agents: Array<{ agentId: string; durationMs: number }> }> = {};
  for (const [category, data] of categories) {
    breakdown[category] = data;
  }

  traceLog.info("Pipeline complete", {
    durationMs: totalDuration,
    eventType: trace.eventType,
    phases: breakdown,
  });

  // Log slow agents as warnings (> 1 second)
  for (const phase of trace.phases) {
    for (const agent of phase.agents) {
      if (agent.durationMs > 1000) {
        traceLog.warn("Slow agent detected", {
          agentId: agent.agentId,
          durationMs: agent.durationMs,
          status: agent.status,
        });
      }
    }
  }
}
