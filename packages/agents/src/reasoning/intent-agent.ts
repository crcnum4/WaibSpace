import type { AgentOutput } from "@waibspace/types";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { NormalizedInput } from "../perception/input-normalizer";

export interface IntentClassification {
  primaryIntent: string;
  intentCategory: string;
  entities: Record<string, string>;
  suggestedAgents: string[];
  confidence: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an intent classifier for WaibSpace, an AI-powered personal assistant.

Analyze the user's input and classify their intent. WaibSpace supports the following capabilities:

- **Email management**: check inbox, summarize emails, reply to emails, search emails
- **Calendar management**: view upcoming events, check availability, schedule meetings
- **Discovery**: find information, movies, restaurants, services, recommendations
- **Task management**: create tasks, list tasks, complete/update tasks

For each input, determine:
1. The primary intent (e.g., "check_email", "find_movie", "schedule_meeting", "create_task")
2. The intent category (one of: "email", "calendar", "discovery", "task", "general")
3. Any entities mentioned (e.g., genre, date, time, person, subject)
4. Which downstream agents should handle this (e.g., "context.email", "context.calendar", "ui.discovery")
5. Your confidence level (0-1)
6. A brief reasoning explanation

Respond with a JSON object matching the IntentClassification schema.`;

const INTENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    primaryIntent: { type: "string" },
    intentCategory: { type: "string" },
    entities: {
      type: "object",
      additionalProperties: { type: "string" },
    },
    suggestedAgents: {
      type: "array",
      items: { type: "string" },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "string" },
  },
  required: [
    "primaryIntent",
    "intentCategory",
    "entities",
    "suggestedAgents",
    "confidence",
    "reasoning",
  ],
};

export class IntentAgent extends BaseAgent {
  constructor() {
    super({
      id: "reasoning.intent",
      name: "IntentAgent",
      type: "intent-classifier",
      category: "reasoning",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const normalizedInput = this.findNormalizedInput(input);
    const userContent = normalizedInput
      ? normalizedInput.normalizedContent
      : this.fallbackContent(input);

    this.log("Classifying intent", { content: userContent });

    const classification = await this.completeStructured<IntentClassification>(
      context,
      "classification",
      [{ role: "user", content: userContent }],
      INTENT_SCHEMA,
      SYSTEM_PROMPT,
    );

    const endMs = Date.now();

    return {
      ...this.createOutput(classification, classification.confidence, {
        dataState: "transformed",
        transformations: ["intent-classification"],
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findNormalizedInput(input: AgentInput): NormalizedInput | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "perception" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("normalizedContent" in output && "inputType" in output) {
          return output as unknown as NormalizedInput;
        }
      }
    }
    return undefined;
  }

  private fallbackContent(input: AgentInput): string {
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload["text"] === "string") {
      return payload["text"];
    }
    return JSON.stringify(input.event.payload ?? "");
  }
}
