import type { AgentOutput } from "@waibspace/types";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { IntentClassification } from "./intent-agent";

export interface ConfidenceAdjustment {
  originalConfidence: number;
  adjustedConfidence: number;
  adjustmentReason: string;
}

const KNOWN_CATEGORIES = new Set([
  "email",
  "calendar",
  "discovery",
  "task",
  "general",
]);

export class ConfidenceScorerAgent extends BaseAgent {
  constructor() {
    super({
      id: "reasoning.confidence-scorer",
      name: "ConfidenceScorer",
      type: "confidence-scorer",
      category: "reasoning",
    });
  }

  async execute(
    input: AgentInput,
    _context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const intentOutput = this.findIntentClassification(input);

    if (!intentOutput) {
      this.log("No intent classification found in prior outputs");
      const adjustment: ConfidenceAdjustment = {
        originalConfidence: 0,
        adjustedConfidence: 0,
        adjustmentReason: "No intent classification available",
      };
      return this.createOutput(adjustment, 0, {
        dataState: "transformed",
        transformations: ["confidence-adjustment"],
        timestamp: startMs,
      });
    }

    const { classification, normalizedContent } = intentOutput;
    const adjustment = this.adjustConfidence(classification, normalizedContent);

    this.log("Adjusted confidence", adjustment);

    const endMs = Date.now();

    return {
      ...this.createOutput(adjustment, adjustment.adjustedConfidence, {
        dataState: "transformed",
        transformations: ["confidence-adjustment"],
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findIntentClassification(input: AgentInput): {
    classification: IntentClassification;
    normalizedContent: string;
  } | undefined {
    let classification: IntentClassification | undefined;
    let normalizedContent = "";

    for (const prior of input.priorOutputs) {
      // Find intent classification
      if (
        prior.category === "reasoning" &&
        prior.agentType === "intent-classifier" &&
        prior.output
      ) {
        classification = prior.output as IntentClassification;
      }

      // Find normalized content for word count
      if (prior.category === "perception" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("normalizedContent" in output) {
          normalizedContent = output["normalizedContent"] as string;
        }
      }
    }

    if (!classification) return undefined;
    return { classification, normalizedContent };
  }

  private adjustConfidence(
    classification: IntentClassification,
    normalizedContent: string,
  ): ConfidenceAdjustment {
    let adjusted = classification.confidence;
    const reasons: string[] = [];

    // Has specific entities extracted? +0.1
    const entityCount = Object.keys(classification.entities).length;
    if (entityCount > 0) {
      adjusted += 0.1;
      reasons.push(`+0.1: ${entityCount} entities extracted`);
    }

    // Intent category is one of known categories? +0.1
    if (KNOWN_CATEGORIES.has(classification.intentCategory)) {
      adjusted += 0.1;
      reasons.push(
        `+0.1: known category "${classification.intentCategory}"`,
      );
    }

    // Input was very short (< 3 words)? -0.1
    const wordCount = normalizedContent.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 3) {
      adjusted -= 0.1;
      reasons.push(`-0.1: short input (${wordCount} words)`);
    }

    // Multiple possible interpretations mentioned in reasoning? -0.15
    const reasoningLower = classification.reasoning.toLowerCase();
    if (
      reasoningLower.includes("could also") ||
      reasoningLower.includes("might also") ||
      reasoningLower.includes("ambiguous") ||
      reasoningLower.includes("multiple") ||
      reasoningLower.includes("unclear")
    ) {
      adjusted -= 0.15;
      reasons.push("-0.15: reasoning indicates ambiguity");
    }

    // Cap high confidence at 0.95
    if (adjusted > 0.95) {
      adjusted = 0.95;
      reasons.push("capped at 0.95");
    }

    // Floor at 0
    if (adjusted < 0) {
      adjusted = 0;
      reasons.push("floored at 0");
    }

    // Round to avoid floating point issues
    adjusted = Math.round(adjusted * 100) / 100;

    return {
      originalConfidence: classification.confidence,
      adjustedConfidence: adjusted,
      adjustmentReason: reasons.join("; "),
    };
  }
}
