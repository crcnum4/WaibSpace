/**
 * Short-Term Memory — ephemeral scratch space scoped to a single pipeline run (traceId).
 *
 * Agents write intermediate results here during execution.
 * Stores are automatically cleaned up when the task completes or after the TTL expires.
 */

export interface ShortTermStore {
  set(key: string, value: unknown): void;
  get<T = unknown>(key: string): T | undefined;
  getAll(): Record<string, unknown>;
  /** Serialize store contents for LLM prompt injection. */
  toContext(): string;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

interface StoreEntry {
  data: Map<string, unknown>;
  createdAt: number;
}

export class ShortTermMemoryManager {
  private stores = new Map<string, StoreEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = DEFAULT_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Create (or return existing) short-term store for a given traceId.
   */
  create(traceId: string): ShortTermStore {
    if (!this.stores.has(traceId)) {
      this.stores.set(traceId, {
        data: new Map(),
        createdAt: Date.now(),
      });
    }

    const entry = this.stores.get(traceId)!;

    return {
      set(key: string, value: unknown): void {
        entry.data.set(key, value);
      },

      get<T = unknown>(key: string): T | undefined {
        return entry.data.get(key) as T | undefined;
      },

      getAll(): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [k, v] of entry.data) {
          result[k] = v;
        }
        return result;
      },

      toContext(): string {
        if (entry.data.size === 0) return "";

        const lines: string[] = ["### Task Memory"];
        for (const [k, v] of entry.data) {
          const formatted =
            typeof v === "string" ? v : JSON.stringify(v);
          lines.push(`- ${k}: ${formatted}`);
        }
        return lines.join("\n") + "\n";
      },
    };
  }

  /**
   * Destroy the store for a given traceId (called when a task completes).
   */
  destroy(traceId: string): void {
    this.stores.delete(traceId);
  }

  /**
   * Check whether a store exists for the given traceId.
   */
  has(traceId: string): boolean {
    return this.stores.has(traceId);
  }

  /**
   * Prune all stores older than the configured TTL.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [traceId, entry] of this.stores) {
      if (now - entry.createdAt > this.defaultTtlMs) {
        this.stores.delete(traceId);
      }
    }
  }

  /**
   * Start periodic auto-cleanup of expired stores.
   */
  startAutoCleanup(intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS): void {
    this.stopAutoCleanup();
    this.cleanupTimer = setInterval(() => this.cleanup(), intervalMs);
  }

  /**
   * Stop the auto-cleanup interval.
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
