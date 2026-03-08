import { SecretStore } from "./secret-store";

export interface ScanResult {
  clean: boolean;
  warnings: string[];
}

/**
 * Well-known API-key prefixes that should never appear in output text.
 * Each entry is a human-readable label paired with a regex pattern.
 */
const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "OpenAI API key", pattern: /sk-[A-Za-z0-9]{20,}/ },
  { label: "Anthropic API key", pattern: /sk-ant-[A-Za-z0-9]{20,}/ },
  { label: "Generic key prefix", pattern: /key-[A-Za-z0-9]{20,}/ },
  {
    label: "Long base64 token",
    pattern: /[A-Za-z0-9+/]{40,}={0,2}/,
  },
];

/**
 * Scan `text` for patterns that look like leaked secrets.
 *
 * When an optional {@link SecretStore} is provided the scanner also
 * checks whether any known secret values appear verbatim in the text.
 */
export function scanForSecrets(
  text: string,
  store?: SecretStore,
): ScanResult {
  const warnings: string[] = [];

  // 1. Pattern-based detection
  for (const { label, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(`Potential secret detected: ${label}`);
    }
  }

  // 2. Known-value detection (if a store is provided)
  if (store) {
    for (const scope of store.listScopes()) {
      // We intentionally iterate with a helper to avoid exposing
      // the internal map structure of SecretStore.  For each scope
      // we check the keys that fromEnv would have created.
      const knownKeys = inferKeysForScope(scope);
      for (const key of knownKeys) {
        const value = store.get(scope, key);
        if (value && value.length >= 8 && text.includes(value)) {
          warnings.push(
            `Known secret value leaked: scope="${scope}", key="${key}"`,
          );
        }
      }
    }
  }

  return { clean: warnings.length === 0, warnings };
}

/**
 * Return the set of key names that {@link SecretStore.fromEnv} would
 * populate for a given scope.  This keeps the scanner decoupled from
 * SecretStore internals while still allowing known-value checks.
 */
function inferKeysForScope(scope: string): string[] {
  const scopeKeys: Record<string, string[]> = {
    anthropic: ["api_key"],
    openai: ["api_key"],
    google: ["client_id", "client_secret", "redirect_uri"],
  };
  return scopeKeys[scope] ?? [];
}
