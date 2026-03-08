import type { AgentOutput, MemoryEntry } from "@waibspace/types";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

export interface InteractionInterpretation {
  interaction: string;
  semanticMeaning: string;
  confidence: number;
  surfaceContext: string;
  actionToTake?: string;
  needsClarification: boolean;
}

const DEFAULT_MAPPINGS: Record<string, Record<string, string>> = {
  inbox: {
    click: "expand",
    "swipe-right": "archive",
    "swipe-left": "snooze",
    "long-press": "expand-details",
    "double-click": "mark-important",
  },
  calendar: {
    click: "view-details",
    "swipe-right": "reschedule",
    "long-press": "expand-details",
  },
  discovery: {
    click: "expand",
    "swipe-right": "save",
    "swipe-left": "dismiss",
  },
  approval: {
    click: "select",
  },
  _default: {
    click: "select",
    "swipe-right": "dismiss",
    "swipe-left": "save",
    "long-press": "expand",
  },
};

/**
 * Interprets user interactions (clicks, swipes, drags) as semantic signals.
 * Deterministic for MVP — uses lookup tables rather than LLM calls.
 */
export class InteractionSemanticsAgent extends BaseAgent {
  constructor() {
    super({
      id: "reasoning.interaction-semantics",
      name: "InteractionSemanticsAgent",
      type: "interaction-interpreter",
      category: "reasoning",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const { interaction, surfaceContext } = this.extractInteraction(input);

    this.log("Interpreting interaction", { interaction, surfaceContext });

    const interpretation = this.interpret(
      interaction,
      surfaceContext,
      context.memory,
    );

    const endMs = Date.now();

    return {
      ...this.createOutput(interpretation, interpretation.confidence, {
        dataState: "transformed",
        transformations: ["interaction-interpretation"],
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private extractInteraction(input: AgentInput): {
    interaction: string;
    surfaceContext: string;
  } {
    const payload = input.event.payload as Record<string, unknown> | undefined;

    const interaction =
      typeof payload?.["interaction"] === "string"
        ? payload["interaction"]
        : typeof payload?.["type"] === "string"
          ? payload["type"]
          : "click";

    const surfaceContext =
      typeof payload?.["surfaceContext"] === "string"
        ? payload["surfaceContext"]
        : typeof payload?.["surface"] === "string"
          ? payload["surface"]
          : "_default";

    return { interaction, surfaceContext };
  }

  private interpret(
    interaction: string,
    surfaceContext: string,
    memory?: MemoryEntry[],
  ): InteractionInterpretation {
    // Check user-specific overrides from memory
    const userOverride = this.findUserOverride(
      interaction,
      surfaceContext,
      memory,
    );
    if (userOverride) {
      return {
        interaction,
        semanticMeaning: userOverride,
        confidence: 0.95,
        surfaceContext,
        actionToTake: userOverride,
        needsClarification: false,
      };
    }

    // Check surface-specific default mappings
    const surfaceMappings = DEFAULT_MAPPINGS[surfaceContext];
    if (surfaceMappings && surfaceMappings[interaction]) {
      const meaning = surfaceMappings[interaction];
      return {
        interaction,
        semanticMeaning: meaning,
        confidence: 0.8,
        surfaceContext,
        actionToTake: meaning,
        needsClarification: false,
      };
    }

    // Fall back to _default mappings
    const fallbackMappings = DEFAULT_MAPPINGS["_default"];
    if (fallbackMappings && fallbackMappings[interaction]) {
      const meaning = fallbackMappings[interaction];
      return {
        interaction,
        semanticMeaning: meaning,
        confidence: 0.5,
        surfaceContext,
        actionToTake: meaning,
        needsClarification: true,
      };
    }

    // Completely unknown interaction
    return {
      interaction,
      semanticMeaning: "unknown",
      confidence: 0.2,
      surfaceContext,
      actionToTake: undefined,
      needsClarification: true,
    };
  }

  private findUserOverride(
    interaction: string,
    surfaceContext: string,
    memory?: MemoryEntry[],
  ): string | undefined {
    if (!memory) return undefined;

    for (const entry of memory) {
      if (entry.category !== "interaction") continue;

      // Look for keys like "interaction-mapping.inbox.swipe-right"
      const expectedKey = `interaction-mapping.${surfaceContext}.${interaction}`;
      if (entry.key === expectedKey && typeof entry.value === "string") {
        return entry.value;
      }
    }

    return undefined;
  }
}
