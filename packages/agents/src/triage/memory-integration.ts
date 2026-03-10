/**
 * TriageMemoryIntegrator — connects triage results to the three-tier memory system.
 *
 * After the DataTriageAgent classifies items, this integrator writes relevant
 * information into mid-term and long-term memory:
 *
 * - Promotional items → mid-term memory (brand summaries with decay)
 * - Informational items → mid-term memory (topic summaries)
 * - Contact patterns → long-term memory (frequent/important contacts)
 */

import type { MidTermMemory } from "@waibspace/memory";
import type { LongTermMemory } from "@waibspace/memory";
import type { TriagedItem } from "./types";

export interface TriageMemoryUpdate {
  tier: "midterm" | "longterm";
  domain: string;
  key: string;
  summary: string;
  keywords?: string[];
}

export class TriageMemoryIntegrator {
  constructor(
    private midTerm: MidTermMemory,
    private longTerm: LongTermMemory,
  ) {}

  /**
   * Process triaged items and store relevant information in memory.
   * Returns the updates that were made.
   */
  async processTriageResults(
    items: TriagedItem[],
  ): Promise<TriageMemoryUpdate[]> {
    const updates: TriageMemoryUpdate[] = [];

    // 1. Promotional items -> mid-term memory
    for (const item of items.filter(
      (i) => i.triage.category === "promotional",
    )) {
      const update = this.storePromoSummary(item);
      if (update) updates.push(update);
    }

    // 2. Contact patterns -> long-term memory (for frequent contacts)
    const contactUpdates = this.updateContactPatterns(items);
    updates.push(...contactUpdates);

    // 3. Informational items -> mid-term memory
    for (const item of items.filter(
      (i) => i.triage.category === "informational",
    )) {
      const update = this.storeInfoSummary(item);
      if (update) updates.push(update);
    }

    return updates;
  }

  private storePromoSummary(item: TriagedItem): TriageMemoryUpdate | null {
    const email = item.raw as Record<string, unknown>;
    const sender = (email.from as string) ?? "";
    const subject = (email.subject as string) ?? "";

    if (!sender && !subject) return null;

    const brandName = this.extractBrandName(sender);
    const key = `promo:${brandName}`;
    const summary = `Promotional email from ${brandName}: ${subject}`;

    // Store in mid-term with domain "email:promotional"
    this.midTerm.store("email:promotional", key, summary);

    return { tier: "midterm", domain: "email:promotional", key, summary };
  }

  private storeInfoSummary(item: TriagedItem): TriageMemoryUpdate | null {
    const email = item.raw as Record<string, unknown>;
    const sender = (email.from as string) ?? "";
    const subject = (email.subject as string) ?? "";

    if (!sender && !subject) return null;

    const source = this.extractBrandName(sender) || "unknown";
    const key = `info:${source}`;
    const summary = `Informational update from ${source}: ${subject}`;

    this.midTerm.store("email:informational", key, summary);

    return { tier: "midterm", domain: "email:informational", key, summary };
  }

  /**
   * Track contact patterns in long-term memory.
   * Groups items by sender, and for senders with multiple messages or
   * high-urgency items, stores a contact entry in long-term memory.
   */
  private updateContactPatterns(
    items: TriagedItem[],
  ): TriageMemoryUpdate[] {
    const updates: TriageMemoryUpdate[] = [];

    // Group items by sender
    const senderMap = new Map<
      string,
      { count: number; urgencies: string[]; categories: string[] }
    >();

    for (const item of items) {
      const email = item.raw as Record<string, unknown>;
      const sender = ((email.from as string) ?? "").toLowerCase().trim();
      if (!sender) continue;

      const existing = senderMap.get(sender) ?? {
        count: 0,
        urgencies: [],
        categories: [],
      };
      existing.count++;
      existing.urgencies.push(item.triage.urgency);
      existing.categories.push(item.triage.category);
      senderMap.set(sender, existing);
    }

    // Store contacts that are either frequent (2+ messages in batch) or high-urgency
    for (const [sender, data] of senderMap) {
      const hasHighUrgency = data.urgencies.includes("high");
      const isFrequent = data.count >= 2;

      if (!hasHighUrgency && !isFrequent) continue;

      const contactName = this.extractBrandName(sender) || sender;
      const keywords = [contactName, "contact", "email"];
      if (hasHighUrgency) keywords.push("important");

      const categoryBreakdown = [...new Set(data.categories)].join(", ");
      const blurb = `Contact ${contactName} — ${data.count} message(s), categories: ${categoryBreakdown}${hasHighUrgency ? ", includes high-urgency" : ""}`;

      this.longTerm.store("contacts:email", keywords, blurb);

      updates.push({
        tier: "longterm",
        domain: "contacts:email",
        key: contactName,
        summary: blurb,
        keywords,
      });
    }

    return updates;
  }

  /**
   * Extract a brand/sender name from an email address or "Name <email>" format.
   * - "John Doe <john@example.com>" -> "John Doe"
   * - "newsletter@acme.com" -> "acme"
   * - "no-reply@github.com" -> "github"
   */
  extractBrandName(sender: string): string {
    // Try "Display Name <email>" pattern
    const nameMatch = sender.match(/^(.+?)\s*</);
    if (nameMatch?.[1]) {
      const name = nameMatch[1].replace(/^["']|["']$/g, "").trim();
      if (name.length > 0) return name;
    }

    // Fall back to domain name from email
    const emailMatch = sender.match(/@([^.>]+)/);
    if (emailMatch?.[1]) {
      return emailMatch[1];
    }

    // Last resort: use the raw sender, cleaned up
    return sender.replace(/[<>@]/g, "").trim() || "unknown";
  }
}
