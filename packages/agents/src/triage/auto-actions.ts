/**
 * AutoActionExecutor — processes triage results and determines which
 * low-risk actions can be auto-executed without user approval.
 *
 * Only actions within the Auto/Low-risk trust tiers are eligible:
 * - mark_read
 * - archive
 * - store_memory (for promotional/informational summaries)
 *
 * Higher-risk actions (reply, forward, etc.) are never auto-executed.
 */

import type { TriagedItem } from "./types";

export interface AutoAction {
  type: string; // "mark_read", "archive", "store_memory", "unsubscribe_recommend"
  target: string; // item ID or identifier
  metadata?: Record<string, unknown>;
}

export interface AutoActionResult {
  action: AutoAction;
  executed: boolean;
  reason?: string;
}

export interface MemoryCandidate {
  domain: string;
  key: string;
  summary: string;
}

/** Actions that are safe to auto-execute without user approval. */
const AUTO_TIER_ACTIONS = new Set([
  "mark_read",
  "archive",
  "unsubscribe_recommend",
]);

/** Actions that require user approval — never auto-executed. */
const APPROVAL_REQUIRED_ACTIONS = new Set([
  "reply",
  "forward",
  "delete",
  "send",
]);

export class AutoActionExecutor {
  /**
   * Process triaged items and return actions that should be auto-executed.
   * Only returns actions within the Auto/Low-risk trust tiers.
   */
  processAutoActions(items: TriagedItem[]): AutoAction[] {
    const actions: AutoAction[] = [];

    for (const item of items) {
      const { triage } = item;
      if (!triage.suggestedAction) continue;

      // Skip actions that require user approval
      if (APPROVAL_REQUIRED_ACTIONS.has(triage.suggestedAction)) continue;

      if (triage.suggestedAction === "mark_read") {
        actions.push({
          type: "mark_read",
          target: triage.itemId,
        });
      } else if (triage.suggestedAction === "archive") {
        actions.push({
          type: "archive",
          target: triage.itemId,
        });
      } else if (triage.suggestedAction === "unsubscribe_recommend") {
        // Store recommendation as memory rather than auto-unsubscribing
        const raw = item.raw as Record<string, unknown>;
        const sender =
          (raw.from as string) ?? (raw.sender as string) ?? "unknown";
        actions.push({
          type: "store_memory",
          target: triage.itemId,
          metadata: {
            recommendation: "unsubscribe",
            sender,
            domain: triage.domain ?? "email",
          },
        });
      } else if (AUTO_TIER_ACTIONS.has(triage.suggestedAction)) {
        actions.push({
          type: triage.suggestedAction,
          target: triage.itemId,
        });
      }
    }

    return actions;
  }

  /**
   * Extract promotional email summaries for memory storage.
   * Returns memory-ready entries from promotional items.
   */
  extractPromoSummaries(items: TriagedItem[]): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    for (const item of items) {
      if (item.triage.category !== "promotional") continue;

      const raw = item.raw as Record<string, unknown>;
      const sender =
        (raw.from as string) ?? (raw.sender as string) ?? "unknown";
      const subject = (raw.subject as string) ?? "";
      const snippet = (raw.snippet as string) ?? (raw.text as string) ?? "";

      // Extract brand/store name from sender (take the name part before <email>)
      const brandMatch = sender.match(/^([^<]+)/);
      const brand = brandMatch ? brandMatch[1].trim() : sender;

      const dealInfo = subject || snippet.slice(0, 100);

      candidates.push({
        domain: "email:promotional",
        key: `promo:${brand.toLowerCase().replace(/\s+/g, "-")}`,
        summary: `${brand}: ${dealInfo}`.slice(0, 200),
      });
    }

    return candidates;
  }

  /**
   * Extract informational summaries for memory storage.
   */
  extractInfoSummaries(items: TriagedItem[]): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    for (const item of items) {
      if (item.triage.category !== "informational") continue;

      const raw = item.raw as Record<string, unknown>;
      const sender =
        (raw.from as string) ?? (raw.sender as string) ?? "unknown";
      const subject = (raw.subject as string) ?? "";
      const snippet = (raw.snippet as string) ?? (raw.text as string) ?? "";

      // Extract key facts from subject + snippet
      const keyFacts = subject || snippet.slice(0, 150);

      candidates.push({
        domain: "email:informational",
        key: `info:${sender.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        summary: keyFacts.slice(0, 200),
      });
    }

    return candidates;
  }
}
