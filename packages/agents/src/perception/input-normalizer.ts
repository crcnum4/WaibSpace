import type { AgentOutput } from "@waibspace/types";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

export interface NormalizedInput {
  inputType: "text" | "interaction" | "url_intent" | "voice";
  normalizedContent: string;
  rawInput: unknown;
  inputMetadata: Record<string, unknown>;
}

export class InputNormalizerAgent extends BaseAgent {
  constructor() {
    super({
      id: "perception.input-normalizer",
      name: "InputNormalizer",
      type: "input-normalizer",
      category: "perception",
    });
  }

  async execute(input: AgentInput, _context: AgentContext): Promise<AgentOutput> {
    const { event } = input;
    const payload = event.payload as Record<string, unknown> | undefined;
    const startMs = Date.now();

    const normalized = this.normalize(event.type, payload);

    this.log("Normalized input", { inputType: normalized.inputType });

    return this.createOutput(normalized, 1.0, {
      relatedEventId: event.id,
      dataState: "transformed",
      transformations: ["input-normalization"],
      timestamp: startMs,
    });
  }

  private normalize(
    eventType: string,
    payload: Record<string, unknown> | undefined,
  ): NormalizedInput {
    if (eventType === "user.message.received") {
      const text = typeof payload?.text === "string" ? payload.text : "";
      return {
        inputType: "text",
        normalizedContent: text,
        rawInput: payload,
        inputMetadata: { originalEventType: eventType },
      };
    }

    if (eventType.startsWith("user.interaction.")) {
      const action = eventType.replace("user.interaction.", "");
      const target = typeof payload?.target === "string" ? payload.target : "unknown";
      return {
        inputType: "interaction",
        normalizedContent: `${action} on ${target}`,
        rawInput: payload,
        inputMetadata: { action, target, originalEventType: eventType },
      };
    }

    if (eventType === "user.intent.url_received") {
      const path = typeof payload?.path === "string" ? payload.path : "";
      return {
        inputType: "url_intent",
        normalizedContent: path,
        rawInput: payload,
        inputMetadata: { originalEventType: eventType },
      };
    }

    if (eventType === "user.voice.transcribed") {
      const transcript = typeof payload?.text === "string" ? payload.text : "";
      return {
        inputType: "voice",
        normalizedContent: transcript,
        rawInput: payload,
        inputMetadata: { originalEventType: eventType },
      };
    }

    // Default: best-effort text extraction
    const content = this.extractBestEffort(payload);
    return {
      inputType: "text",
      normalizedContent: content,
      rawInput: payload,
      inputMetadata: { originalEventType: eventType, fallback: true },
    };
  }

  private extractBestEffort(payload: Record<string, unknown> | undefined): string {
    if (!payload) return "";

    // Try common field names
    for (const key of ["text", "message", "content", "body", "query", "input"]) {
      if (typeof payload[key] === "string") {
        return payload[key] as string;
      }
    }

    // Last resort: stringify
    try {
      return JSON.stringify(payload);
    } catch {
      return "";
    }
  }
}
