import type { AgentOutput } from "@waibspace/types";
import type { LongTermMemory } from "@waibspace/memory";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

export interface MemoryRecallOutput {
  recalled: Array<{
    keywords: string[];
    blurb: string;
    domain: string;
    relevance: number;
  }>;
  query: string;
}

export class MemoryRecallAgent extends BaseAgent {
  constructor() {
    super({
      id: "context.memory-recall",
      name: "MemoryRecallAgent",
      type: "memory-recall",
      category: "context",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();
    const longTermMemory = context.config?.[
      "longTermMemory"
    ] as LongTermMemory | undefined;

    if (!longTermMemory) {
      return this.createOutput({ recalled: [], query: "" }, 0.5);
    }

    // Extract searchable terms from the user message
    const payload = input.event.payload as
      | Record<string, unknown>
      | undefined;
    const userMessage =
      (payload?.text as string) ?? (payload?.message as string) ?? "";

    if (!userMessage || userMessage.length < 3) {
      return this.createOutput({ recalled: [], query: "" }, 0.5);
    }

    // Extract potential names, topics from the message
    const query = this.extractSearchTerms(userMessage);
    if (!query) {
      return this.createOutput({ recalled: [], query: "" }, 0.5);
    }

    // Search long-term memory
    const results = longTermMemory.recall(query, 5);

    const output: MemoryRecallOutput = {
      recalled: results.map((r) => ({
        keywords: r.keywords,
        blurb: r.blurb,
        domain: r.domain,
        relevance: 1.0,
      })),
      query,
    };

    this.log("Memory recall", { query, resultCount: results.length });

    return {
      ...this.createOutput(output, results.length > 0 ? 0.9 : 0.3, {
        sourceType: "memory",
        dataState: "raw",
        freshness: "recent",
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs: Date.now(),
        durationMs: Date.now() - startMs,
      },
    };
  }

  /**
   * Extract meaningful search terms from user message.
   * Focus on proper nouns, specific terms, and quoted phrases.
   */
  private extractSearchTerms(message: string): string {
    // Look for quoted phrases first
    const quoted = message.match(/"([^"]+)"/);
    if (quoted) return quoted[1];

    // Look for "remember X" pattern
    const rememberMatch = message.match(/remember\s+(.+?)(?:\?|$)/i);
    if (rememberMatch) return rememberMatch[1].trim();

    // Look for "about X" pattern
    const aboutMatch = message.match(/about\s+(.+?)(?:\?|$)/i);
    if (aboutMatch) return aboutMatch[1].trim();

    // Extract capitalized words (likely proper nouns) -- at least 2 chars
    const properNouns = message.match(/\b[A-Z][a-z]{1,}\b/g);
    if (properNouns && properNouns.length > 0) {
      return properNouns.join(" ");
    }

    // Fallback: use the whole message if short enough
    if (message.length < 50) return message;

    return "";
  }
}
