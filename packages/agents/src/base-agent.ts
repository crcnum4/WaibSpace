import type {
  AgentCategory,
  AgentOutput,
  ProvenanceMetadata,
} from "@waibspace/types";
import type {
  Message,
  CompletionResponse,
  ModelRoleConfig,
} from "@waibspace/model-provider";
import { createLogger, type Logger } from "@waibspace/logger";
import type { Agent, AgentInput, AgentContext } from "./types";

export abstract class BaseAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly category: AgentCategory;
  protected readonly logger: Logger;

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
    this.logger = createLogger(`agent:${config.id}`);
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

  /**
   * Send a completion request using the model provider configured for a given role.
   * Requires `context.modelProvider` to be set.
   */
  protected async complete(
    context: AgentContext,
    role: keyof ModelRoleConfig,
    messages: Message[],
    system?: string,
  ): Promise<CompletionResponse> {
    if (!context.modelProvider)
      throw new Error("No model provider in context");
    const { provider, model } = context.modelProvider.getForRole(role);
    return provider.complete({ model, messages, system });
  }

  /**
   * Send a structured completion request that returns a typed response.
   * Requires `context.modelProvider` to be set.
   */
  protected async completeStructured<T>(
    context: AgentContext,
    role: keyof ModelRoleConfig,
    messages: Message[],
    responseSchema: Record<string, unknown>,
    system?: string,
  ): Promise<T> {
    if (!context.modelProvider)
      throw new Error("No model provider in context");
    const { provider, model } = context.modelProvider.getForRole(role);
    return provider.completeStructured<T>({
      model,
      messages,
      responseSchema,
      system,
    });
  }

  protected log(message: string, data?: Record<string, unknown>): void {
    this.logger.info(message, { category: this.category, ...data });
  }
}
