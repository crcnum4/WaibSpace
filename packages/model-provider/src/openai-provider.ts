import type {
  ModelProvider,
  CompletionRequest,
  CompletionResponse,
  StructuredCompletionRequest,
} from "./types";

export class OpenAIProvider implements ModelProvider {
  id = "openai";
  name = "OpenAI";

  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    throw new Error("OpenAI provider not yet implemented");
  }

  async completeStructured<T>(
    _request: StructuredCompletionRequest,
  ): Promise<T> {
    throw new Error("OpenAI provider not yet implemented");
  }
}
