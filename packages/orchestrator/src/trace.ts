import type { AgentCategory, AgentOutput } from "@waibspace/types";

export interface PipelineTrace {
  traceId: string;
  eventType: string;
  startMs: number;
  endMs: number;
  phases: PhaseTrace[];
}

export interface PhaseTrace {
  category: AgentCategory;
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
 * Log a pipeline trace summary to the console.
 */
export function logTrace(trace: PipelineTrace): void {
  const totalDuration = trace.endMs - trace.startMs;
  const totalAgents = trace.phases.reduce(
    (sum, phase) => sum + phase.agents.length,
    0,
  );

  console.log(
    `[Orchestrator] trace=${trace.traceId} event=${trace.eventType} ` +
      `phases=${trace.phases.length} agents=${totalAgents} duration=${totalDuration}ms`,
  );

  for (const phase of trace.phases) {
    for (const agent of phase.agents) {
      console.log(
        `  [${phase.category}] ${agent.agentId} (${agent.agentType}) ` +
          `status=${agent.status} confidence=${agent.confidence} duration=${agent.durationMs}ms`,
      );
    }
  }
}
