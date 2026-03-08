/**
 * Scoped secret store for managing API keys and credentials.
 *
 * Secrets are organized by scope (e.g. "anthropic", "google") and key
 * (e.g. "api_key", "client_secret"). Values are never exposed through
 * enumeration — only explicit `get()` calls return the actual value.
 */
export class SecretStore {
  private secrets: Map<string, Map<string, string>>;

  constructor() {
    this.secrets = new Map();
  }

  /**
   * Build a SecretStore from well-known environment variables.
   *
   * Mapping:
   *   ANTHROPIC_API_KEY     → scope "anthropic", key "api_key"
   *   OPENAI_API_KEY        → scope "openai",    key "api_key"
   *   GOOGLE_CLIENT_ID      → scope "google",    key "client_id"
   *   GOOGLE_CLIENT_SECRET  → scope "google",    key "client_secret"
   *   GOOGLE_REDIRECT_URI   → scope "google",    key "redirect_uri"
   */
  static fromEnv(): SecretStore {
    const store = new SecretStore();

    const mapping: Array<{ env: string; scope: string; key: string }> = [
      { env: "ANTHROPIC_API_KEY", scope: "anthropic", key: "api_key" },
      { env: "OPENAI_API_KEY", scope: "openai", key: "api_key" },
      { env: "GOOGLE_CLIENT_ID", scope: "google", key: "client_id" },
      { env: "GOOGLE_CLIENT_SECRET", scope: "google", key: "client_secret" },
      { env: "GOOGLE_REDIRECT_URI", scope: "google", key: "redirect_uri" },
    ];

    for (const { env, scope, key } of mapping) {
      const value = process.env[env];
      if (value !== undefined) {
        store.set(scope, key, value);
      }
    }

    return store;
  }

  /** Retrieve a secret value, or `undefined` if it does not exist. */
  get(scope: string, key: string): string | undefined {
    return this.secrets.get(scope)?.get(key);
  }

  /** Check whether a secret exists without revealing its value. */
  has(scope: string, key: string): boolean {
    return this.secrets.get(scope)?.has(key) ?? false;
  }

  /** Return the list of scopes that contain at least one secret. */
  listScopes(): string[] {
    return Array.from(this.secrets.keys());
  }

  /** Programmatically add or overwrite a secret (useful for testing). */
  set(scope: string, key: string, value: string): void {
    let scopeMap = this.secrets.get(scope);
    if (!scopeMap) {
      scopeMap = new Map();
      this.secrets.set(scope, scopeMap);
    }
    scopeMap.set(key, value);
  }
}
