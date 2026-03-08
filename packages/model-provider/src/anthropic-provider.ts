import Anthropic from "@anthropic-ai/sdk";
import type {
  ModelProvider,
  CompletionRequest,
  CompletionResponse,
  StructuredCompletionRequest,
} from "./types";

export class AnthropicProvider implements ModelProvider {
  id = "anthropic";
  name = "Anthropic";
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 1024,
      ...(request.system ? { system: request.system } : {}),
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find((block) => block.type === "text");
    const content = textContent?.type === "text" ? textContent.text : "";

    return {
      content,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason: response.stop_reason ?? "unknown",
    };
  }

  async completeStructured<T>(
    request: StructuredCompletionRequest,
  ): Promise<T> {
    const schemaInstruction = `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(request.responseSchema, null, 2)}`;

    const systemPrompt = (request.system ?? "") + schemaInstruction;

    const response = await this.complete({
      ...request,
      system: systemPrompt,
    });

    return JSON.parse(response.content) as T;
  }
}
