export interface ModelProvider {
  id: string;
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  completeStructured<T>(request: StructuredCompletionRequest): Promise<T>;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface StructuredCompletionRequest extends CompletionRequest {
  responseSchema: Record<string, unknown>;
}

export interface CompletionResponse {
  content: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  stopReason: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}
