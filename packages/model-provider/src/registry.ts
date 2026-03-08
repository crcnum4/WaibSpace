import type { ModelProvider } from "./types";
import type { ModelRoleConfig } from "./config";
import { DEFAULT_MODEL_CONFIG } from "./config";

export class ModelProviderRegistry {
  private providers = new Map<string, ModelProvider>();
  private config: ModelRoleConfig;

  constructor(config?: Partial<ModelRoleConfig>) {
    this.config = { ...DEFAULT_MODEL_CONFIG, ...config };
  }

  register(provider: ModelProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): ModelProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider '${id}' not registered`);
    return p;
  }

  getForRole(
    role: keyof ModelRoleConfig,
  ): { provider: ModelProvider; model: string } {
    const roleConfig = this.config[role];
    return {
      provider: this.getProvider(roleConfig.provider),
      model: roleConfig.model,
    };
  }
}
