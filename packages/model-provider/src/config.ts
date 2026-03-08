export interface ModelRoleConfig {
  reasoning: { provider: string; model: string };
  classification: { provider: string; model: string };
  summarization: { provider: string; model: string };
  uiGeneration: { provider: string; model: string };
}

export const DEFAULT_MODEL_CONFIG: ModelRoleConfig = {
  reasoning: { provider: "anthropic", model: "claude-sonnet-4-6" },
  classification: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  },
  summarization: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  },
  uiGeneration: { provider: "anthropic", model: "claude-sonnet-4-6" },
};
