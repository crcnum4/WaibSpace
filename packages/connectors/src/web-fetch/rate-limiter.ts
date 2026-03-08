/**
 * Simple in-memory rate limiter: max N requests per domain per window.
 * Tracks request timestamps and rejects when the limit is exceeded.
 */

const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  /** domain -> sorted list of timestamps (epoch ms) */
  private readonly timestamps = new Map<string, number[]>();

  constructor(
    maxRequests: number = DEFAULT_MAX_REQUESTS,
    windowMs: number = DEFAULT_WINDOW_MS,
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check whether a request to `domain` is allowed right now.
   * If allowed, records the request and returns `{ allowed: true }`.
   * If not, returns `{ allowed: false, retryAfterMs }`.
   */
  check(domain: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let entries = this.timestamps.get(domain);
    if (entries) {
      // Prune old entries
      entries = entries.filter((t) => t > cutoff);
      this.timestamps.set(domain, entries);
    } else {
      entries = [];
      this.timestamps.set(domain, entries);
    }

    if (entries.length >= this.maxRequests) {
      // Earliest entry determines when a slot opens
      const retryAfterMs = entries[0] + this.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
    }

    entries.push(now);
    return { allowed: true };
  }

  /** Remove all tracked state (useful for tests). */
  reset(): void {
    this.timestamps.clear();
  }
}
