import { describe, it, expect, beforeEach } from "bun:test";
import { MemoryStore } from "../memory-store";
import { ContactProfileStore, parseFromHeader } from "../contact-profile-store";

describe("ContactProfileStore", () => {
  let memoryStore: MemoryStore;
  let store: ContactProfileStore;

  beforeEach(() => {
    memoryStore = new MemoryStore();
    store = new ContactProfileStore(memoryStore);
  });

  describe("parseFromHeader", () => {
    it("parses 'Name <email>' format", () => {
      const result = parseFromHeader("Alice Smith <alice@example.com>");
      expect(result.name).toBe("Alice Smith");
      expect(result.email).toBe("alice@example.com");
    });

    it("parses quoted name format", () => {
      const result = parseFromHeader('"Bob Jones" <bob@test.com>');
      expect(result.name).toBe("Bob Jones");
      expect(result.email).toBe("bob@test.com");
    });

    it("parses bare email", () => {
      const result = parseFromHeader("alice@example.com");
      expect(result.name).toBe("");
      expect(result.email).toBe("alice@example.com");
    });

    it("normalizes email to lowercase", () => {
      const result = parseFromHeader("Alice <ALICE@Example.COM>");
      expect(result.email).toBe("alice@example.com");
    });
  });

  describe("recordInteraction", () => {
    it("creates a new profile on first interaction", () => {
      const profile = store.recordInteraction(
        "Alice Smith <alice@example.com>",
        1000,
      );
      expect(profile.email).toBe("alice@example.com");
      expect(profile.name).toBe("Alice Smith");
      expect(profile.initials).toBe("AS");
      expect(profile.emailCount).toBe(1);
      expect(profile.isVip).toBe(false);
      expect(profile.avatarHue).toBeGreaterThanOrEqual(0);
      expect(profile.avatarHue).toBeLessThan(360);
    });

    it("increments count on subsequent interactions", () => {
      store.recordInteraction("Alice <alice@example.com>", 1000);
      const profile = store.recordInteraction(
        "Alice <alice@example.com>",
        2000,
      );
      expect(profile.emailCount).toBe(2);
      expect(profile.lastSeen).toBe(2000);
    });

    it("uses email prefix as name when no name provided", () => {
      const profile = store.recordInteraction("bob@test.com", 1000);
      expect(profile.name).toBe("bob");
      expect(profile.initials).toBe("BO");
    });
  });

  describe("VIP detection", () => {
    it("does not mark as VIP with fewer than 5 emails", () => {
      for (let i = 0; i < 4; i++) {
        store.recordInteraction(
          "Alice <alice@example.com>",
          1000 + i * 86400000,
        );
      }
      const profile = store.getProfile("alice@example.com");
      expect(profile?.isVip).toBe(false);
    });

    it("marks as VIP with 5+ emails and weekly frequency", () => {
      // 6 emails, one per day
      for (let i = 0; i < 6; i++) {
        store.recordInteraction(
          "Alice <alice@example.com>",
          1000 + i * 86400000, // 1 day apart
        );
      }
      const profile = store.getProfile("alice@example.com");
      expect(profile?.isVip).toBe(true);
      expect(profile?.vipReason).toBeDefined();
    });

    it("does not mark infrequent sender as VIP", () => {
      // 5 emails, one per month
      for (let i = 0; i < 5; i++) {
        store.recordInteraction(
          "Bob <bob@test.com>",
          1000 + i * 30 * 86400000, // 30 days apart
        );
      }
      const profile = store.getProfile("bob@test.com");
      expect(profile?.isVip).toBe(false);
    });
  });

  describe("ingestBatch", () => {
    it("processes multiple emails at once", () => {
      store.ingestBatch([
        { from: "Alice <alice@example.com>", date: "2026-01-01T00:00:00Z" },
        { from: "Alice <alice@example.com>", date: "2026-01-02T00:00:00Z" },
        { from: "Bob <bob@test.com>", date: "2026-01-01T00:00:00Z" },
      ]);

      expect(store.getProfile("alice@example.com")?.emailCount).toBe(2);
      expect(store.getProfile("bob@test.com")?.emailCount).toBe(1);
    });
  });

  describe("getSenderSummary", () => {
    it("returns undefined for unknown sender", () => {
      expect(store.getSenderSummary("unknown@test.com")).toBeUndefined();
    });

    it("returns summary for known sender", () => {
      store.recordInteraction("Alice Smith <alice@example.com>", 1000);
      const summary = store.getSenderSummary("Alice Smith <alice@example.com>");
      expect(summary).toBeDefined();
      expect(summary?.name).toBe("Alice Smith");
      expect(summary?.initials).toBe("AS");
      expect(summary?.frequencyLabel).toBe("First email");
    });
  });

  describe("getVips", () => {
    it("returns only VIP contacts", () => {
      // Make alice a VIP (6 daily emails)
      for (let i = 0; i < 6; i++) {
        store.recordInteraction(
          "Alice <alice@example.com>",
          1000 + i * 86400000,
        );
      }
      // Bob only sends once
      store.recordInteraction("Bob <bob@test.com>", 1000);

      const vips = store.getVips();
      expect(vips.length).toBe(1);
      expect(vips[0].email).toBe("alice@example.com");
    });
  });

  describe("avatar hue", () => {
    it("is deterministic for the same email", () => {
      store.recordInteraction("Alice <alice@example.com>", 1000);
      const profile1 = store.getProfile("alice@example.com");

      // Create a fresh store with same memory
      const store2 = new ContactProfileStore(memoryStore);
      const profile2 = store2.getProfile("alice@example.com");

      expect(profile1?.avatarHue).toBe(profile2?.avatarHue);
    });
  });
});
