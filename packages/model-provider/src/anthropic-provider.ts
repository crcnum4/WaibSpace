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
  private _warmedUp = false;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Pre-warm the API connection by sending a minimal request.
   * This resolves DNS, establishes TLS, and prepares the HTTP/2 connection
   * so the first real request is faster.
   */
  async warmUp(): Promise<void> {
    if (this._warmedUp) return;
    const startMs = Date.now();
    try {
      await this.client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      this._warmedUp = true;
      console.log(
        `[model-provider:anthropic] Connection pre-warmed in ${Date.now() - startMs}ms`,
      );
    } catch (error) {
      // Non-fatal — connection will be established on first real request
      console.warn(
        `[model-provider:anthropic] Warm-up failed (${Date.now() - startMs}ms): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startMs = Date.now();

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

    const durationMs = Date.now() - startMs;
    const textContent = response.content.find((block) => block.type === "text");
    const content = textContent?.type === "text" ? textContent.text : "";

    console.log(
      `[model-provider:anthropic] ${request.model} complete: ${durationMs}ms ` +
        `(in=${response.usage.input_tokens} out=${response.usage.output_tokens} tokens)`,
    );

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
    const schemaInstruction = `\n\nRespond ONLY with valid JSON matching this schema. Do NOT wrap in markdown fences. Output raw JSON only:\n${JSON.stringify(request.responseSchema, null, 2)}`;

    const systemPrompt = (request.system ?? "") + schemaInstruction;

    const response = await this.complete({
      ...request,
      system: systemPrompt,
    });

    return this.parseStructuredResponse<T>(response.content);
  }

  private parseStructuredResponse<T>(content: string): T {
    // Try direct parse first
    try {
      return JSON.parse(content) as T;
    } catch {
      // Strip markdown fences if present
      const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        try {
          return JSON.parse(fenceMatch[1]) as T;
        } catch {
          // fall through
        }
      }

      // Try to find first { ... } or [ ... ] block
      const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]) as T;
        } catch {
          // fall through
        }
      }

      throw new Error(
        `Failed to parse structured response as JSON. Raw content: ${content.slice(0, 200)}`,
      );
    }
  }
}
