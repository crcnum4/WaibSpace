import type { MemoryStore } from "./memory-store";

/**
 * A sender profile built heuristically from email interactions.
 * Stored in the MemoryStore under the "relationship" category.
 */
export interface ContactProfile {
  /** Canonical email address (lowercase) */
  email: string;
  /** Display name extracted from the "From" header */
  name: string;
  /** Initials derived from name (1-2 chars) */
  initials: string;
  /** Deterministic hue (0-359) for avatar background */
  avatarHue: number;
  /** Total number of emails received from this sender */
  emailCount: number;
  /** Timestamp of the first known interaction */
  firstSeen: number;
  /** Timestamp of the most recent interaction */
  lastSeen: number;
  /** Average time (ms) between consecutive emails from this sender */
  avgIntervalMs: number;
  /** Whether this contact qualifies as a VIP (frequent sender) */
  isVip: boolean;
  /** Short label explaining VIP status, e.g. "Emails you weekly" */
  vipReason?: string;
}

/** Minimum emails required before a contact can become VIP */
const VIP_MIN_EMAILS = 5;

/**
 * Maximum average interval (7 days in ms) to qualify as VIP.
 * If a sender averages more than 7 days between emails, they are not VIP.
 */
const VIP_MAX_AVG_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ContactProfileStore builds and maintains sender profiles from email
 * interaction data. It persists profiles in the MemoryStore under the
 * "relationship" category with keys prefixed by "contact:".
 *
 * All logic is heuristic-based — no external dependencies required.
 */
export class ContactProfileStore {
  constructor(private memoryStore: MemoryStore) {}

  /**
   * Record an email interaction and update the sender's profile.
   * Call this each time an email batch is processed.
   *
   * @param fromHeader Raw "From" header value, e.g. "Alice Smith <alice@example.com>"
   * @param timestamp  Epoch ms of the email (defaults to now)
   * @returns The updated ContactProfile
   */
  recordInteraction(fromHeader: string, timestamp?: number): ContactProfile {
    const ts = timestamp ?? Date.now();
    const { name, email } = parseFromHeader(fromHeader);
    const key = contactKey(email);

    const existing = this.getProfile(email);

    if (existing) {
      // Update existing profile
      const updated: ContactProfile = {
        ...existing,
        name: name || existing.name, // prefer newer non-empty name
        emailCount: existing.emailCount + 1,
        lastSeen: Math.max(existing.lastSeen, ts),
        firstSeen: Math.min(existing.firstSeen, ts),
        avgIntervalMs: 0, // recomputed below
        isVip: false, // recomputed below
      };

      // Recompute average interval
      const spanMs = updated.lastSeen - updated.firstSeen;
      updated.avgIntervalMs =
        updated.emailCount > 1 ? spanMs / (updated.emailCount - 1) : 0;

      // Recompute VIP status
      const { isVip, reason } = evaluateVip(updated);
      updated.isVip = isVip;
      updated.vipReason = reason;

      this.memoryStore.set("relationship", key, updated, "contact-profile-store");
      return updated;
    }

    // Create new profile
    const profile: ContactProfile = {
      email,
      name: name || email.split("@")[0],
      initials: getInitials(name || email.split("@")[0]),
      avatarHue: deterministicHue(email),
      emailCount: 1,
      firstSeen: ts,
      lastSeen: ts,
      avgIntervalMs: 0,
      isVip: false,
    };

    this.memoryStore.set("relationship", key, profile, "contact-profile-store");
    return profile;
  }

  /**
   * Ingest a batch of emails at once — convenience wrapper.
   * Each email object should have `from` (header string) and `date` (ISO string or epoch).
   */
  ingestBatch(
    emails: Array<{ from: string; date?: string | number }>,
  ): void {
    for (const email of emails) {
      const ts =
        typeof email.date === "number"
          ? email.date
          : email.date
            ? new Date(email.date).getTime()
            : Date.now();
      this.recordInteraction(email.from, isNaN(ts) ? Date.now() : ts);
    }
  }

  /**
   * Look up a profile by email address.
   */
  getProfile(email: string): ContactProfile | undefined {
    const entry = this.memoryStore.get("relationship", contactKey(normalizeEmail(email)));
    return entry?.value as ContactProfile | undefined;
  }

  /**
   * Look up a profile from a raw "From" header.
   */
  getProfileFromHeader(fromHeader: string): ContactProfile | undefined {
    const { email } = parseFromHeader(fromHeader);
    return this.getProfile(email);
  }

  /**
   * Return all stored contact profiles.
   */
  getAllProfiles(): ContactProfile[] {
    return this.memoryStore
      .getAll("relationship")
      .filter((entry) => entry.key.startsWith("contact:"))
      .map((entry) => entry.value as ContactProfile);
  }

  /**
   * Return all VIP contacts.
   */
  getVips(): ContactProfile[] {
    return this.getAllProfiles().filter((p) => p.isVip);
  }

  /**
   * Build a sender profile summary suitable for attaching to email card props.
   * Returns undefined if no profile exists for the sender.
   */
  getSenderSummary(fromHeader: string): SenderSummary | undefined {
    const profile = this.getProfileFromHeader(fromHeader);
    if (!profile) return undefined;

    return {
      email: profile.email,
      name: profile.name,
      initials: profile.initials,
      avatarHue: profile.avatarHue,
      emailCount: profile.emailCount,
      isVip: profile.isVip,
      vipReason: profile.vipReason,
      lastSeen: profile.lastSeen,
      frequencyLabel: frequencyLabel(profile),
    };
  }
}

/**
 * Lightweight sender summary passed to frontend email cards.
 */
export interface SenderSummary {
  email: string;
  name: string;
  initials: string;
  avatarHue: number;
  emailCount: number;
  isVip: boolean;
  vipReason?: string;
  lastSeen: number;
  frequencyLabel: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function contactKey(email: string): string {
  return `contact:${normalizeEmail(email)}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Parse a "From" header like "Alice Smith <alice@example.com>"
 * into { name, email }.
 */
export function parseFromHeader(from: string): { name: string; email: string } {
  // Match "Name <email>" pattern
  const match = from.match(/^(.+?)\s*<([^>]+)>/);
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, "").trim(),
      email: normalizeEmail(match[2]),
    };
  }

  // Bare email address
  const emailOnly = from.trim();
  if (emailOnly.includes("@")) {
    return { name: "", email: normalizeEmail(emailOnly) };
  }

  // Just a name (no email) — use as-is, email becomes the lowercased name
  return { name: emailOnly, email: normalizeEmail(emailOnly) };
}

/**
 * Extract initials from a name. Returns 1-2 uppercase characters.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Deterministic hue (0-359) from a string using a simple hash.
 * Same email always produces the same colour.
 */
function deterministicHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/**
 * Evaluate VIP status based on interaction frequency.
 */
function evaluateVip(profile: ContactProfile): { isVip: boolean; reason?: string } {
  if (profile.emailCount < VIP_MIN_EMAILS) {
    return { isVip: false };
  }

  if (profile.avgIntervalMs > 0 && profile.avgIntervalMs <= VIP_MAX_AVG_INTERVAL_MS) {
    const reason = describeFrequency(profile.avgIntervalMs);
    return { isVip: true, reason };
  }

  return { isVip: false };
}

/**
 * Describe the email frequency in human-readable terms.
 */
function describeFrequency(avgIntervalMs: number): string {
  const hours = avgIntervalMs / (1000 * 60 * 60);
  if (hours < 24) return "Emails you daily";
  const days = hours / 24;
  if (days < 3) return "Emails you every few days";
  return "Emails you weekly";
}

/**
 * Short label describing how often this sender emails.
 */
function frequencyLabel(profile: ContactProfile): string {
  if (profile.emailCount === 1) return "First email";
  if (profile.avgIntervalMs === 0) return `${profile.emailCount} emails`;

  const hours = profile.avgIntervalMs / (1000 * 60 * 60);
  if (hours < 24) return "Daily sender";
  const days = Math.round(hours / 24);
  if (days === 1) return "Daily sender";
  if (days < 7) return `Every ~${days} days`;
  if (days < 14) return "Weekly sender";
  if (days < 30) return "Bi-weekly sender";
  return "Occasional sender";
}
