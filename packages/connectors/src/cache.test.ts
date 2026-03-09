import { describe, it, expect, vi, beforeEach } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  let cache: TtlCache<string>;

  beforeEach(() => {
    cache = new TtlCache<string>({ defaultTtlMs: 1000 });
  });

  // --- Basic get/set ---

  it("returns undefined on cache miss", () => {
    expect(cache.get("nope")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
  });

  it("returns undefined after TTL expires", () => {
    vi.useFakeTimers();
    try {
      cache.set("k", "v", 100);
      vi.advanceTimersByTime(101);
      expect(cache.get("k")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("respects per-key TTL override", () => {
    vi.useFakeTimers();
    try {
      cache.set("short", "a", 50);
      cache.set("long", "b", 200);
      vi.advanceTimersByTime(100);
      expect(cache.get("short")).toBeUndefined();
      expect(cache.get("long")).toBe("b");
    } finally {
      vi.useRealTimers();
    }
  });

  // --- has ---

  it("has() returns true for fresh entries", () => {
    cache.set("k", "v");
    expect(cache.has("k")).toBe(true);
  });

  it("has() returns false after expiry", () => {
    vi.useFakeTimers();
    try {
      cache.set("k", "v", 50);
      vi.advanceTimersByTime(51);
      expect(cache.has("k")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  // --- delete / clear ---

  it("delete removes a key", () => {
    cache.set("k", "v");
    cache.delete("k");
    expect(cache.get("k")).toBeUndefined();
  });

  it("clear empties the cache", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
  });

  // --- invalidateByPrefix ---

  it("invalidateByPrefix removes matching keys", () => {
    cache.set("gmail:list:abc", "x");
    cache.set("gmail:get:def", "y");
    cache.set("calendar:list:ghi", "z");
    const count = cache.invalidateByPrefix("gmail:");
    expect(count).toBe(2);
    expect(cache.size).toBe(1);
    expect(cache.get("calendar:list:ghi")).toBe("z");
  });

  // --- maxEntries eviction ---

  it("evicts oldest entry when maxEntries is exceeded", () => {
    const small = new TtlCache<string>({ defaultTtlMs: 10000, maxEntries: 2 });
    small.set("a", "1");
    small.set("b", "2");
    small.set("c", "3");
    expect(small.size).toBe(2);
    expect(small.get("a")).toBeUndefined(); // evicted
    expect(small.get("b")).toBe("2");
    expect(small.get("c")).toBe("3");
  });

  // --- stale-while-revalidate ---

  it("returns stale value and triggers revalidate callback", async () => {
    vi.useFakeTimers();
    try {
      const swr = new TtlCache<string>({
        defaultTtlMs: 100,
        staleWhileRevalidate: true,
      });
      swr.set("k", "old");
      vi.advanceTimersByTime(150); // now stale

      const revalidate = vi.fn().mockResolvedValue("fresh");
      const value = swr.get("k", revalidate);

      expect(value).toBe("old"); // stale returned immediately
      expect(revalidate).toHaveBeenCalledTimes(1);

      // Let the microtask resolve
      await vi.runAllTimersAsync();

      expect(swr.get("k")).toBe("fresh");
    } finally {
      vi.useRealTimers();
    }
  });

  // --- buildKey ---

  it("buildKey produces deterministic keys", () => {
    const k1 = TtlCache.buildKey("gmail", "list", { limit: 10, q: "is:unread" });
    const k2 = TtlCache.buildKey("gmail", "list", { limit: 10, q: "is:unread" });
    expect(k1).toBe(k2);
  });

  it("buildKey differs for different params", () => {
    const k1 = TtlCache.buildKey("gmail", "list", { limit: 10 });
    const k2 = TtlCache.buildKey("gmail", "list", { limit: 20 });
    expect(k1).not.toBe(k2);
  });

  // --- hashParams determinism ---

  it("hashParams is stable regardless of key insertion order", () => {
    const h1 = TtlCache.hashParams({ a: 1, b: 2 });
    const h2 = TtlCache.hashParams({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });
});
