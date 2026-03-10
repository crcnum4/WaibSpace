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

export class EmailTriageClassifier implements TriageClassifier {
  readonly id = "email";
  readonly supportedConnectors = ["gmail", "mail", "email"];

  async classify(
    items: unknown[],
    _context?: TriageContext,
  ): Promise<TriageResult[]> {
    return items.map((item, index) => {
      const email = item as Record<string, unknown>;
      const { urgency, score } = classifyEmailUrgency(email);

      const category = classifyCategory(email, urgency);
      const action = suggestAction(category, urgency, email);

      // Derive an item ID from the email or fall back to index
      const itemId =
        (email.id as string) ??
        (email.messageId as string) ??
        `email-${index}`;

      // Confidence based on score magnitude — higher absolute score = more confident
      const confidence = Math.min(1, 0.5 + Math.abs(score) * 0.05);

      return {
        itemId,
        urgency,
        category,
        suggestedAction: action,
        confidence,
        reasoning: generateReasoning(category, urgency, score),
        domain: "email",
      };
    });
  }
}
