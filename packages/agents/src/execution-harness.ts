import type { AgentOutput } from "@waibspace/types";
import type { Agent, AgentInput, AgentContext } from "./types";

export interface ExecutionOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function executeAgent(
  agent: Agent,
  input: AgentInput,
  context: AgentContext,
  options?: ExecutionOptions,
): Promise<AgentOutput> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startMs = Date.now();

  try {
    const result = await Promise.race<AgentOutput>([
      agent.execute(input, context),
      new Promise<AgentOutput>((_, reject) =>
        setTimeout(() => reject(new Error("Agent execution timed out")), timeoutMs),
      ),
    ]);

    const endMs = Date.now();

    return {
      ...result,
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
      provenance: {
        ...result.provenance,
        sourceType: "agent",
        sourceId: agent.id,
      },
    };
  } catch (error) {
    const endMs = Date.now();
    const message =
      error instanceof Error ? error.message : "Unknown error during agent execution";

    console.error(
      `[executeAgent] [trace:${context.traceId}] Agent ${agent.id} (${agent.category}:${agent.name}) failed after ${endMs - startMs}ms: ${message}`,
    );

    return {
      agentId: agent.id,
      agentType: agent.type,
      category: agent.category,
      output: { error: message },
      confidence: 0,
      provenance: {
        sourceType: "agent",
        sourceId: agent.id,
        trustLevel: "untrusted",
        timestamp: startMs,
        freshness: "realtime",
        dataState: "raw",
      },
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }
}
