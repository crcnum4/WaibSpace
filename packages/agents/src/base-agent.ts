import type {
  AgentCategory,
  AgentOutput,
  ProvenanceMetadata,
} from "@waibspace/types";
import type { Agent, AgentInput, AgentContext } from "./types";

export abstract class BaseAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly category: AgentCategory;

  constructor(config: {
    id: string;
    name: string;
    type: string;
    category: AgentCategory;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.category = config.category;
  }

  abstract execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput>;

  protected createOutput(
    output: unknown,
    confidence: number,
    provenance?: Partial<ProvenanceMetadata>,
  ): AgentOutput {
    return {
      agentId: this.id,
      agentType: this.type,
      category: this.category,
      output,
      confidence,
      provenance: {
        sourceType: "agent",
        sourceId: this.id,
        trustLevel: "trusted",
        timestamp: Date.now(),
        freshness: "realtime",
        dataState: "transformed",
        ...provenance,
      },
      timing: { startMs: 0, endMs: 0, durationMs: 0 },
    };
  }

  protected log(message: string, data?: unknown): void {
    console.log(`[${this.category}:${this.name}] ${message}`, data ?? "");
  }
}
