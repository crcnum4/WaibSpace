import type { AgentOutput, MemoryEntry, MemoryCategory } from "@waibspace/types";
import type { MemoryStore, MidTermMemory, LongTermMemory, ShortTermStore } from "@waibspace/memory";
import { resolveMemoryDomains, buildMemoryContext, extractKeywords } from "@waibspace/memory";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { IntentClassification } from "../reasoning";

const MAX_ENTRIES_PER_CATEGORY = 20;

export interface MemoryRetrievalOutput {
  memories: MemoryEntry[];
  categories: string[];
  totalRetrieved: number;
  /** Combined memory context string from all tiers (for downstream LLM injection) */
  memoryContext?: string;
  /** Domains resolved for this event */
  resolvedDomains?: string[];
}

/**
 * Deterministic (rule-based) agent that retrieves relevant memories
 * from both the legacy MemoryStore and the three-tier memory system.
 *
 * When mid-term and long-term memory are available, it uses domain-selective
 * injection via resolveMemoryDomains() and buildMemoryContext().
 *
 * Falls back to the legacy MemoryStore when tiers are not configured.
 */
export class MemoryRetrievalAgent extends BaseAgent {
  constructor() {
    super({
      id: "memory-retrieval",
      name: "memory-retrieval",
      type: "context.memory-retrieval",
      category: "context",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const midTermMemory = context.config?.["midTermMemory"] as MidTermMemory | undefined;
    const longTermMemory = context.config?.["longTermMemory"] as LongTermMemory | undefined;
    const shortTermMemory = context.config?.["shortTermMemory"] as ShortTermStore | undefined;

    // If three-tier memory is available, use domain-selective injection
    if (midTermMemory && longTermMemory) {
      return this.executeWithTiers(input, context, midTermMemory, longTermMemory, shortTermMemory, startMs);
    }

    // Legacy fallback: use the flat MemoryStore
    return this.executeLegacy(input, context, startMs);
  }

  /**
   * Three-tier memory retrieval with domain-selective injection.
   */
  private executeWithTiers(
    input: AgentInput,
    _context: AgentContext,
    midTerm: MidTermMemory,
    longTerm: LongTermMemory,
    shortTerm: ShortTermStore | undefined,
    startMs: number,
  ): AgentOutput {
    const intent = this.findIntentClassification(input);
    const payload = input.event.payload as Record<string, unknown> | undefined;

    // Resolve which memory domains are relevant for this event
    const domains = resolveMemoryDomains(
      input.event.type,
      payload,
      intent?.intentCategory,
    );

    // Extract keywords from the event payload for long-term recall
    const keywords = extractKeywords(payload);

    this.log("Three-tier memory retrieval", {
      domains,
      keywords,
      intentCategory: intent?.intentCategory,
      hasShortTerm: !!shortTerm,
    });

    // Build the combined memory context string
    const memoryContext = buildMemoryContext(
      shortTerm,
      midTerm,
      longTerm,
      domains,
      keywords.length > 0 ? keywords : undefined,
    );

    const output: MemoryRetrievalOutput = {
      memories: [], // Legacy field — tiered memories are in memoryContext
      categories: domains,
      totalRetrieved: 0,
      memoryContext: memoryContext || undefined,
      resolvedDomains: domains,
    };

    return {
      ...this.createOutput(output, memoryContext ? 1.0 : 0.5, {
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
   * Legacy memory retrieval using the flat MemoryStore.
   * Preserved for backward compatibility when tiers are not configured.
   */
  private executeLegacy(
    input: AgentInput,
    context: AgentContext,
    startMs: number,
  ): AgentOutput {
    const memoryStore = context.config?.["memoryStore"] as
      | MemoryStore
      | undefined;

    if (!memoryStore) {
      this.log("No MemoryStore in context — returning empty result");
      return this.buildOutput([], startMs);
    }

    const intent = this.findIntentClassification(input);
    const categoriesToRetrieve: MemoryCategory[] = ["profile"];

    if (intent) {
      const additional = this.categoriesForIntent(intent.intentCategory);
      for (const cat of additional) {
        if (!categoriesToRetrieve.includes(cat)) {
          categoriesToRetrieve.push(cat);
        }
      }
      this.log("Retrieving memories for intent", {
        intentCategory: intent.intentCategory,
        memoryCategories: categoriesToRetrieve,
      });
    } else {
      this.log(
        "No intent classification found — falling back to profile memory only",
      );
    }

    const memories: MemoryEntry[] = [];

    for (const category of categoriesToRetrieve) {
      const entries = memoryStore.getRecent(category, MAX_ENTRIES_PER_CATEGORY);
      memories.push(...entries);
    }

    return this.buildOutput(memories, startMs);
  }

  /**
   * Map an intent category string to the MemoryCategories we should retrieve.
   * Profile is always included by the caller, so we only return additional ones.
   */
  private categoriesForIntent(intentCategory: string): MemoryCategory[] {
    switch (intentCategory) {
      case "email":
        return ["task", "interaction"];
      case "calendar":
        return ["task"];
      case "discovery":
        return ["interaction"];
      default:
        return [];
    }
  }

  private findIntentClassification(
    input: AgentInput,
  ): IntentClassification | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "reasoning" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("primaryIntent" in output && "intentCategory" in output) {
          return output as unknown as IntentClassification;
        }
      }
    }
    return undefined;
  }

  private buildOutput(
    memories: MemoryEntry[],
    startMs: number,
  ): AgentOutput {
    const categories = Array.from(new Set(memories.map((m) => m.category)));
    const endMs = Date.now();

    const output: MemoryRetrievalOutput = {
      memories,
      categories,
      totalRetrieved: memories.length,
    };

    return {
      ...this.createOutput(output, memories.length > 0 ? 1.0 : 0.5, {
        sourceType: "memory",
        dataState: "raw",
        freshness: "recent",
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
