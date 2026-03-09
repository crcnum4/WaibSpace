/**
 * In-memory sliding-window rate limiter.
 *
 * Each client (identified by IP) gets a window of `windowMs` milliseconds
 * during which they may make up to `maxRequests` requests. Expired entries
 * are pruned lazily on each check and periodically via a sweep timer.
 *
 * Configurable via environment variables:
 *   RATE_LIMIT_MAX       — max requests per window  (default: 100)
 *   RATE_LIMIT_WINDOW_MS — window size in ms         (default: 60 000 = 1 min)
 */

export interface RateLimitConfig {
  /** Maximum requests allowed within the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface ClientRecord {
  /** Timestamps (epoch ms) of requests within the current window. */
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Seconds until the oldest request in the window expires (for Retry-After). */
  retryAfterSecs: number;
}

export function loadRateLimitConfig(): RateLimitConfig {
  return {
    maxRequests: Number(process.env.RATE_LIMIT_MAX) || 100,
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  };
}

export class RateLimiter {
  private clients = new Map<string, ClientRecord>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Periodically sweep stale entries to prevent memory leaks from
    // clients that made a burst of requests then disappeared.
    this.sweepTimer = setInterval(() => this.sweep(), config.windowMs * 2);
    // Allow the process to exit even if the timer is still running.
    if (this.sweepTimer && typeof this.sweepTimer === "object" && "unref" in this.sweepTimer) {
      (this.sweepTimer as NodeJS.Timeout).unref();
    }
  }

  /**
   * Check whether a request from `clientId` is allowed.
   * If allowed, the request is recorded; otherwise it is not.
   */
  check(clientId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let record = this.clients.get(clientId);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(clientId, record);
    }

    // Prune timestamps outside the window
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    if (record.timestamps.length >= this.config.maxRequests) {
      // Oldest request in the window — how long until it expires
      const oldestInWindow = record.timestamps[0];
      const retryAfterMs = oldestInWindow + this.config.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSecs: Math.ceil(retryAfterMs / 1000),
      };
    }

    // Record this request
    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.config.maxRequests - record.timestamps.length,
      retryAfterSecs: 0,
    };
  }

  /** Remove stale client entries. */
  private sweep(): void {
    const windowStart = Date.now() - this.config.windowMs;
    for (const [clientId, record] of this.clients) {
      record.timestamps = record.timestamps.filter((t) => t > windowStart);
      if (record.timestamps.length === 0) {
        this.clients.delete(clientId);
      }
    }
  }

  /** Stop the background sweep timer (useful for graceful shutdown / tests). */
  stop(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}
