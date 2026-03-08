export interface ModelRoleConfig {
  /** Used by reasoning/planning agents (e.g., PlannerAgent, ReasoningAgent) */
  reasoning: { provider: string; model: string };
  /** Used by classification/routing agents (e.g., IntentClassifier, CategoryAgent) */
  classification: { provider: string; model: string };
  /** Used by summarization agents (e.g., SummaryAgent, DigestAgent) */
  summarization: { provider: string; model: string };
  /** Used by UI generation agents (e.g., UIComposerAgent, LayoutAgent) */
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

/**
 * Environment variable names for overriding model config.
 * Format: WAIBSPACE_MODEL_{ROLE} for model, WAIBSPACE_PROVIDER_{ROLE} for provider.
 *
 * Examples:
 *   WAIBSPACE_MODEL_REASONING=claude-sonnet-4-6
 *   WAIBSPACE_PROVIDER_REASONING=anthropic
 *   WAIBSPACE_MODEL_CLASSIFICATION=claude-haiku-4-5-20251001
 *   WAIBSPACE_MODEL_UI_GENERATION=claude-sonnet-4-6
 */
const ENV_ROLE_MAP: Record<keyof ModelRoleConfig, string> = {
  reasoning: "REASONING",
  classification: "CLASSIFICATION",
  summarization: "SUMMARIZATION",
  uiGeneration: "UI_GENERATION",
};

/**
 * Creates a ModelRoleConfig by merging defaults with environment variable
 * overrides and any explicit overrides passed in.
 *
 * Environment variables checked (per role):
 *   - WAIBSPACE_MODEL_{ROLE} — overrides the model name
 *   - WAIBSPACE_PROVIDER_{ROLE} — overrides the provider id
 *
 * @param overrides - Explicit overrides that take precedence over env vars
 * @returns A fully resolved ModelRoleConfig
 */
export function createModelConfig(
  overrides?: Partial<ModelRoleConfig>,
): ModelRoleConfig {
  const config = { ...DEFAULT_MODEL_CONFIG };

  for (const [role, envSuffix] of Object.entries(ENV_ROLE_MAP) as Array<
    [keyof ModelRoleConfig, string]
  >) {
    const envModel = process.env[`WAIBSPACE_MODEL_${envSuffix}`];
    const envProvider = process.env[`WAIBSPACE_PROVIDER_${envSuffix}`];

    if (envModel || envProvider) {
      config[role] = {
        provider: envProvider ?? config[role].provider,
        model: envModel ?? config[role].model,
      };
    }
  }

  // Explicit overrides take highest precedence
  if (overrides) {
    for (const [role, value] of Object.entries(overrides) as Array<
      [keyof ModelRoleConfig, { provider: string; model: string }]
    >) {
      if (value) {
        config[role] = { ...config[role], ...value };
      }
    }
  }

  return config;
}
