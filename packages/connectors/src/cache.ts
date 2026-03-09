/**
 * Generic in-memory TTL cache with optional stale-while-revalidate support.
 *
 * No external dependencies — uses Map + setTimeout for expiry.
 */

export interface CacheOptions {
  /** Default time-to-live in milliseconds. */
  defaultTtlMs: number;
  /** Maximum number of entries. Oldest entries are evicted when exceeded. */
  maxEntries?: number;
  /**
   * When true, return stale data immediately while refreshing in the
   * background. The revalidation callback must be supplied at get-time.
   */
  staleWhileRevalidate?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  /** Timestamp when the entry was stored. */
  storedAt: number;
}

export class TtlCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly opts: Required<CacheOptions>;

  constructor(options: CacheOptions) {
    this.opts = {
      defaultTtlMs: options.defaultTtlMs,
      maxEntries: options.maxEntries ?? 500,
      staleWhileRevalidate: options.staleWhileRevalidate ?? false,
    };
  }

  /** Store a value with an optional per-key TTL override. */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.opts.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value as string;
      this.store.delete(oldest);
    }

    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + (ttlMs ?? this.opts.defaultTtlMs),
      storedAt: now,
    });
  }

  /**
   * Retrieve a cached value.
   *
   * @param key       - Cache key.
   * @param revalidate - Async function called in the background when the entry
   *                     is stale and `staleWhileRevalidate` is enabled. The
   *                     resolved value is written back into the cache.
   * @returns The cached value, or `undefined` on miss / expiry.
   */
  get(key: string, revalidate?: () => Promise<T>): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    const now = Date.now();

    if (now < entry.expiresAt) {
      // Fresh — return immediately.
      return entry.value;
    }

    // Entry is stale.
    if (this.opts.staleWhileRevalidate && revalidate) {
      // Return stale value; refresh in the background.
      void revalidate().then((fresh) => {
        this.set(key, fresh);
      });
      return entry.value;
    }

    // Expired and no SWR — delete and miss.
    this.store.delete(key);
    return undefined;
  }

  /** Check whether a fresh entry exists for the key. */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Remove a single key. */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /** Remove all entries whose keys start with the given prefix. */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Remove all entries. */
  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  // ---- Key helpers ----

  /**
   * Build a deterministic cache key from structured parts.
   *
   * Format: `connectorId:operation:paramsHash`
   */
  static buildKey(
    connectorId: string,
    operation: string,
    params: Record<string, unknown>,
  ): string {
    const paramsHash = TtlCache.hashParams(params);
    return `${connectorId}:${operation}:${paramsHash}`;
  }

  /**
   * Produce a short, deterministic hash string from a params object.
   * Uses a simple djb2-style hash over the sorted JSON representation.
   */
  static hashParams(params: Record<string, unknown>): string {
    const sorted = JSON.stringify(params, Object.keys(params).sort());
    let hash = 5381;
    for (let i = 0; i < sorted.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = ((hash << 5) + hash + sorted.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
  }
}
