import type { AgentOutput } from "@waibspace/types";
import type { MemoryStore, BehavioralModel } from "@waibspace/memory";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

/**
 * Output shape produced by the BehavioralPreferenceAgent.
 * Downstream agents can read these preferences from priorOutputs.
 */
export interface BehavioralPreferenceOutput {
  /** All currently learned preferences keyed by "domain:preferenceKey". */
  preferences: Record<
    string,
    { value: string | number; confidence: number; observationCount: number }
  >;
  /** Number of preferences available. */
  totalPreferences: number;
}

/**
 * Context-phase agent that runs the BehavioralModel to compute current
 * user preferences and makes them available to downstream agents via
 * the standard priorOutputs pipeline.
 *
 * This is purely heuristic — no LLM calls. It reads behavioral aggregates
 * from the MemoryStore, runs statistical derivation, and outputs a flat
 * preferences map.
 */
export class BehavioralPreferenceAgent extends BaseAgent {
  constructor() {
    super({
      id: "behavioral-preference",
      name: "behavioral-preference",
      type: "context.behavioral-preference",
      category: "context",
    });
  }

  async execute(
    _input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const memoryStore = context.config?.["memoryStore"] as
      | MemoryStore
      | undefined;

    if (!memoryStore) {
      this.log("No MemoryStore in context — returning empty preferences");
      return this.buildOutput({}, 0, startMs);
    }

    // Lazy-import to avoid circular dependency at module level.
    // BehavioralModel is a pure computation class with no side effects.
    const { BehavioralModel: Model } = await import("@waibspace/memory");
    const model = new Model(memoryStore) as InstanceType<typeof BehavioralModel>;

    const learned = model.computePreferences();

    const preferences: BehavioralPreferenceOutput["preferences"] = {};
    for (const pref of learned) {
      const key = `${pref.domain}:${pref.preferenceKey}`;
      preferences[key] = {
        value: pref.value,
        confidence: pref.confidence,
        observationCount: pref.observationCount,
      };
    }

    this.log("Computed behavioral preferences", {
      count: learned.length,
    });

    return this.buildOutput(preferences, learned.length, startMs);
  }

  private buildOutput(
    preferences: BehavioralPreferenceOutput["preferences"],
    count: number,
    startMs: number,
  ): AgentOutput {
    const endMs = Date.now();
    const output: BehavioralPreferenceOutput = {
      preferences,
      totalPreferences: count,
    };

    return {
      ...this.createOutput(output, count > 0 ? 1.0 : 0.5, {
        sourceType: "memory",
        dataState: "transformed",
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
