import { describe, it, expect, afterEach } from "bun:test";
import { RateLimiter, type RateLimitConfig } from "../rate-limiter";

function makeConfig(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return { maxRequests: 5, windowMs: 1000, ...overrides };
}

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.stop();
  });

  it("allows requests under the limit", () => {
    limiter = new RateLimiter(makeConfig());
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("client-a");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("rejects requests over the limit", () => {
    limiter = new RateLimiter(makeConfig({ maxRequests: 3 }));
    limiter.check("client-b");
    limiter.check("client-b");
    limiter.check("client-b");

    const result = limiter.check("client-b");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSecs).toBeGreaterThan(0);
  });

  it("tracks clients independently", () => {
    limiter = new RateLimiter(makeConfig({ maxRequests: 1 }));
    expect(limiter.check("client-x").allowed).toBe(true);
    expect(limiter.check("client-x").allowed).toBe(false);
    // Different client should still be allowed
    expect(limiter.check("client-y").allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    limiter = new RateLimiter(makeConfig({ maxRequests: 1, windowMs: 50 }));
    expect(limiter.check("client-z").allowed).toBe(true);
    expect(limiter.check("client-z").allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.check("client-z").allowed).toBe(true);
  });
});
