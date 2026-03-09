import type { AgentOutput, ConversationTurn } from "@waibspace/types";
import type { ConversationContextStore } from "@waibspace/memory";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

/** Maximum number of recent turns to include in agent output. */
const MAX_CONTEXT_TURNS = 10;

export interface ConversationContextOutput {
  /** Recent conversation turns for this session. */
  conversationHistory: ConversationTurn[];
  /** The session ID the history belongs to. */
  sessionId: string;
  /** Total number of turns stored (may be larger than returned history). */
  totalTurns: number;
}

/**
 * Context agent that injects recent conversation history into the pipeline.
 *
 * It reads from the ConversationContextStore (passed via `context.config`)
 * and exposes the last N turns so downstream agents (context-planner,
 * intent agent, surface agents) can resolve multi-turn references like
 * "Reply to her latest" after "Show me emails from Alice".
 *
 * This agent also records the current user message as a new turn before
 * returning, so it is available in subsequent pipeline runs.
 */
export class ConversationContextAgent extends BaseAgent {
  constructor() {
    super({
      id: "context.conversation",
      name: "ConversationContextAgent",
      type: "context.conversation",
      category: "context",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const store = context.config?.["conversationContextStore"] as
      | ConversationContextStore
      | undefined;

    if (!store) {
      this.log("No ConversationContextStore in context — skipping");
      return this.buildOutput([], "unknown", 0, startMs);
    }

    // Derive session ID from event metadata or traceId prefix.
    // The frontend should pass a stable sessionId in event.metadata;
    // fall back to traceId (unique per request, so no cross-turn context).
    const sessionId = this.resolveSessionId(input);

    // Record the current user message as a turn
    const userMessage = this.extractUserMessage(input);
    if (userMessage) {
      store.addTurn(sessionId, {
        role: "user",
        content: userMessage,
        timestamp: input.event.timestamp,
        traceId: input.event.traceId,
      });
    }

    // Retrieve recent history (excluding the turn we just added, plus it)
    const history = store.getHistory(sessionId, MAX_CONTEXT_TURNS);
    const totalTurns = store.getHistory(sessionId).length;

    this.log("Retrieved conversation context", {
      sessionId,
      returnedTurns: history.length,
      totalTurns,
    });

    return this.buildOutput(history, sessionId, totalTurns, startMs);
  }

  private resolveSessionId(input: AgentInput): string {
    const meta = input.event.metadata as Record<string, unknown> | undefined;
    if (meta?.sessionId && typeof meta.sessionId === "string") {
      return meta.sessionId;
    }
    // Fall back: use "default" so all requests without explicit session
    // share a single conversation context (simple single-user case).
    return "default";
  }

  private extractUserMessage(input: AgentInput): string | undefined {
    const payload = input.event.payload as Record<string, unknown> | null;
    if (!payload) return undefined;

    // user.message.received events carry the text in payload.message
    if (typeof payload.message === "string") {
      return payload.message;
    }
    // Normalized input from perception agents
    if (typeof payload.text === "string") {
      return payload.text;
    }
    return undefined;
  }

  private buildOutput(
    history: ConversationTurn[],
    sessionId: string,
    totalTurns: number,
    startMs: number,
  ): AgentOutput {
    const endMs = Date.now();
    const output: ConversationContextOutput = {
      conversationHistory: history,
      sessionId,
      totalTurns,
    };

    return {
      ...this.createOutput(output, history.length > 0 ? 1.0 : 0.5, {
        sourceType: "memory",
        dataState: "raw",
        freshness: "realtime",
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }
}
