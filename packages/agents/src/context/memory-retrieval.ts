import type { AgentOutput, MemoryEntry, MemoryCategory } from "@waibspace/types";
import type { MemoryStore } from "@waibspace/memory";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { IntentClassification } from "../reasoning";

const MAX_ENTRIES_PER_CATEGORY = 20;

export interface MemoryRetrievalOutput {
  memories: MemoryEntry[];
  categories: string[];
  totalRetrieved: number;
}

/**
 * Deterministic (rule-based) agent that retrieves relevant memories
 * from the MemoryStore based on the current intent classification.
 *
 * Runs early in the context phase so downstream agents have memory available.
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
