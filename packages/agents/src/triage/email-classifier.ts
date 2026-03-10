/**
 * Email triage classifier that wraps the existing heuristic-based
 * email urgency scoring from email-urgency.ts and maps results
 * into the generic TriageResult format.
 */

import { classifyEmailUrgency } from "../ui/email-urgency";
import type {
  TriageClassifier,
  TriageContext,
  TriageResult,
  TriageCategory,
  UrgencyLevel,
} from "./types";

// Keywords that signal promotional content
const PROMOTIONAL_KEYWORDS = [
  "unsubscribe",
  "newsletter",
  "promo",
  "promotional",
  "sale",
  "% off",
  "special offer",
  "limited time",
  "deal of",
  "discount",
  "coupon",
  "free shipping",
];

// Keywords that signal newsletter content
const NEWSLETTER_KEYWORDS = [
  "newsletter",
  "digest",
  "weekly update",
  "daily update",
  "weekly roundup",
  "weekly recap",
];

// Personal email domains
const PERSONAL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "fastmail.com",
  "hey.com",
  "mail.com",
];

function extractSearchableText(email: Record<string, unknown>): string {
  const subject = (email.subject as string) ?? "";
  const body =
    (email.snippet as string) ??
    (email.text as string) ??
    (email.body as string) ??
    "";
  return `${subject} ${body}`.toLowerCase();
}

function extractSender(email: Record<string, unknown>): string {
  return ((email.from as string) ?? (email.sender as string) ?? "").toLowerCase();
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function classifyCategory(
  email: Record<string, unknown>,
  urgency: UrgencyLevel,
): TriageCategory {
  const searchable = extractSearchableText(email);
  const sender = extractSender(email);
  const labels = (email.labels as string[]) ?? [];
  const upperLabels = labels.map((l) => l.toUpperCase());

  // Promotional signals
  if (
    upperLabels.includes("CATEGORY_PROMOTIONS") ||
    hasKeyword(searchable, PROMOTIONAL_KEYWORDS)
  ) {
    return "promotional";
  }

  // Informational / newsletter
  if (
    upperLabels.includes("CATEGORY_UPDATES") ||
    hasKeyword(searchable, NEWSLETTER_KEYWORDS)
  ) {
    return "informational";
  }

  // Personal — from a personal domain and not automated
  const senderDomain = sender.split("@")[1] ?? "";
  const isFromNoreply = /no-?reply|noreply|do-?not-?reply|notifications?@/i.test(
    sender,
  );
  if (PERSONAL_DOMAINS.includes(senderDomain) && !isFromNoreply) {
    return "personal";
  }

  // High urgency typically means actionable
  if (urgency === "high") {
    return "actionable";
  }

  // Default to professional for work-related email
  return "professional";
}

function suggestAction(
  category: TriageCategory,
  urgency: UrgencyLevel,
  email: Record<string, unknown>,
): string | undefined {
  const searchable = extractSearchableText(email);

  // Promotional + low urgency → mark as read
  if (category === "promotional" && urgency === "low") {
    return "mark_read";
  }

  // Newsletter pattern → recommend unsubscribe
  if (hasKeyword(searchable, NEWSLETTER_KEYWORDS) && urgency === "low") {
    return "unsubscribe_recommend";
  }

  // High urgency + actionable → reply
  if (urgency === "high" && category === "actionable") {
    return "reply";
  }

  // Informational → archive
  if (category === "informational") {
    return "archive";
  }

  return undefined;
}

function generateReasoning(
  category: TriageCategory,
  urgency: UrgencyLevel,
  score: number,
): string {
  const parts: string[] = [];
  parts.push(`Urgency score: ${score} → ${urgency}`);
  parts.push(`Category: ${category}`);
  return parts.join(". ");
}

/**
 * Check if the memory context mentions a specific sender.
 * Returns true if sender name/email appears in the context string.
 */
function isKnownInMemory(sender: string, memoryContext: string): boolean {
  if (!memoryContext || !sender) return false;
  const lower = memoryContext.toLowerCase();
  const senderLower = sender.toLowerCase();

  // Check full sender string
  if (lower.includes(senderLower)) return true;

  // Check just the email address or domain
  const emailMatch = senderLower.match(/@([^.>]+)/);
  if (emailMatch?.[1] && lower.includes(emailMatch[1])) return true;

  // Check display name
  const nameMatch = senderLower.match(/^(.+?)\s*</);
  if (nameMatch?.[1]) {
    const name = nameMatch[1].replace(/^["']|["']$/g, "").trim();
    if (name.length > 2 && lower.includes(name)) return true;
  }

  return false;
}

/**
 * Apply memory-based urgency adjustments.
 * Known VIP contacts get urgency boosted; known promotional senders stay low.
 */
function adjustUrgencyFromMemory(
  urgency: UrgencyLevel,
  sender: string,
  subject: string,
  memoryContext: string,
): { urgency: UrgencyLevel; memoryBoost: boolean } {
  if (!memoryContext) return { urgency, memoryBoost: false };

  const lower = memoryContext.toLowerCase();
  const senderKnown = isKnownInMemory(sender, memoryContext);

  // If sender is known as important/high-urgency contact, boost
  if (senderKnown && lower.includes("important")) {
    if (urgency === "low") return { urgency: "medium", memoryBoost: true };
    if (urgency === "medium") return { urgency: "high", memoryBoost: true };
  }

  // If memory mentions topic being tracked, boost relevance
  const subjectWords = subject
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  for (const word of subjectWords) {
    if (lower.includes(word) && (lower.includes("track") || lower.includes("follow"))) {
      if (urgency === "low") return { urgency: "medium", memoryBoost: true };
      break;
    }
  }

  return { urgency, memoryBoost: false };
}

export class EmailTriageClassifier implements TriageClassifier {
  readonly id = "email";
  readonly supportedConnectors = ["gmail", "mail", "email"];

  async classify(
    items: unknown[],
    context?: TriageContext,
  ): Promise<TriageResult[]> {
    const memoryContext = context?.memoryContext ?? "";

    return items.map((item, index) => {
      const email = item as Record<string, unknown>;
      const { urgency: baseUrgency, score } = classifyEmailUrgency(email);

      const sender = extractSender(email);
      const subject = (email.subject as string) ?? "";

      // Apply memory-based adjustments
      const { urgency, memoryBoost } = adjustUrgencyFromMemory(
        baseUrgency,
        sender,
        subject,
        memoryContext,
      );

      const category = classifyCategory(email, urgency);
      const action = suggestAction(category, urgency, email);

      // Derive an item ID from the email or fall back to index
      const itemId =
        (email.id as string) ??
        (email.messageId as string) ??
        `email-${index}`;

      // Confidence based on score magnitude — higher absolute score = more confident
      let confidence = Math.min(1, 0.5 + Math.abs(score) * 0.05);
      // Memory-backed classifications get a confidence boost
      if (memoryBoost) confidence = Math.min(1, confidence + 0.1);

      const reasoning = memoryBoost
        ? `${generateReasoning(category, urgency, score)}. Urgency boosted by memory context`
        : generateReasoning(category, urgency, score);

      return {
        itemId,
        urgency,
        category,
        suggestedAction: action,
        confidence,
        reasoning,
        domain: "email",
      };
    });
  }
}
