/**
 * Heuristic-based email urgency scoring.
 *
 * Assigns a score to each email based on lightweight signals (keywords,
 * sender patterns, recency, calendar mentions, reply-chain depth) and
 * maps the score to a high / medium / low urgency level.
 *
 * No LLM calls — runs synchronously on raw email data.
 */

type UrgencyLevel = "high" | "medium" | "low";

interface RawEmail {
  from?: string;
  sender?: string;
  subject?: string;
  snippet?: string;
  text?: string;
  body?: string;
  date?: string;
  receivedAt?: string;
  isUnread?: boolean;
  unread?: boolean;
  labels?: string[];
  /** Thread message count or similar */
  threadSize?: number;
  replyCount?: number;
}

// ── Keyword lists ──────────────────────────────────────────────────

const HIGH_URGENCY_KEYWORDS = [
  "urgent",
  "asap",
  "immediately",
  "action required",
  "action needed",
  "deadline",
  "time-sensitive",
  "time sensitive",
  "critical",
  "emergency",
  "expiring",
  "expires today",
  "final notice",
  "last chance",
  "respond by",
  "reply needed",
  "overdue",
  "past due",
  "eod",
  "end of day",
];

const MEDIUM_URGENCY_KEYWORDS = [
  "follow up",
  "follow-up",
  "followup",
  "reminder",
  "pending",
  "waiting on",
  "please review",
  "feedback requested",
  "review requested",
  "fyi",
  "heads up",
  "heads-up",
  "invitation",
  "invite",
  "rsvp",
  "meeting",
  "schedule",
  "calendar",
  "call",
  "sync",
  "standup",
  "stand-up",
];

const LOW_SIGNAL_KEYWORDS = [
  "unsubscribe",
  "no-reply",
  "noreply",
  "do not reply",
  "do-not-reply",
  "newsletter",
  "digest",
  "weekly update",
  "daily update",
  "promotional",
  "promo",
  "sale",
  "off your",
  "% off",
  "limited time",
  "special offer",
  "deal of",
];

// Senders whose emails are typically low-priority (automated / marketing)
const LOW_PRIORITY_SENDER_PATTERNS = [
  /no-?reply/i,
  /noreply/i,
  /do-?not-?reply/i,
  /notifications?@/i,
  /digest@/i,
  /newsletter@/i,
  /marketing@/i,
  /promo(tions?)?@/i,
  /updates?@/i,
  /info@/i,
  /support@/i,
  /mailer-daemon/i,
];

// ── Scoring logic ──────────────────────────────────────────────────

function keywordScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) hits++;
  }
  return hits;
}

function recencyScore(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    const hoursAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 1) return 3;
    if (hoursAgo < 4) return 2;
    if (hoursAgo < 24) return 1;
    return 0;
  } catch {
    return 0;
  }
}

function senderScore(sender: string): number {
  for (const pattern of LOW_PRIORITY_SENDER_PATTERNS) {
    if (pattern.test(sender)) return -3;
  }
  return 0;
}

function replyChainScore(email: RawEmail): number {
  // Deep reply chains (Re: Re: Re:) suggest an active conversation
  const subject = email.subject ?? "";
  const reCount = (subject.match(/\bRe:/gi) ?? []).length;
  if (reCount >= 3) return 2;
  if (reCount >= 1) return 1;

  // Thread size from metadata
  const threadSize = email.threadSize ?? email.replyCount ?? 0;
  if (threadSize >= 5) return 2;
  if (threadSize >= 2) return 1;

  return 0;
}

function calendarMentionScore(text: string): number {
  const calendarPatterns = [
    /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i,
    /\bmeeting\b/i,
    /\bcalendar\b/i,
    /\bschedul/i,
    /\brsvp\b/i,
    /\bat \d{1,2}(:\d{2})?\s*(am|pm)\b/i,
  ];
  let hits = 0;
  for (const pat of calendarPatterns) {
    if (pat.test(text)) hits++;
  }
  return Math.min(hits, 2); // cap at 2
}

function labelScore(labels: string[] | undefined): number {
  if (!labels) return 0;
  const upper = labels.map((l) => l.toUpperCase());
  let score = 0;
  if (upper.includes("IMPORTANT")) score += 2;
  if (upper.includes("STARRED")) score += 2;
  if (upper.includes("CATEGORY_PROMOTIONS")) score -= 3;
  if (upper.includes("CATEGORY_SOCIAL")) score -= 2;
  if (upper.includes("CATEGORY_UPDATES")) score -= 1;
  if (upper.includes("SPAM")) score -= 5;
  return score;
}

/**
 * Compute a numeric urgency score for a single raw email.
 * Higher = more urgent. The score is then mapped to a level.
 */
function computeScore(email: RawEmail): number {
  const sender = email.from ?? email.sender ?? "";
  const subject = email.subject ?? "";
  const body = email.snippet ?? email.text ?? email.body ?? "";
  const searchable = `${subject} ${body}`;
  const dateStr = email.date ?? email.receivedAt;

  let score = 0;

  // Keyword analysis (subject weighted more heavily)
  score += keywordScore(subject, HIGH_URGENCY_KEYWORDS) * 4;
  score += keywordScore(body, HIGH_URGENCY_KEYWORDS) * 2;
  score += keywordScore(subject, MEDIUM_URGENCY_KEYWORDS) * 2;
  score += keywordScore(body, MEDIUM_URGENCY_KEYWORDS) * 1;
  score -= keywordScore(searchable, LOW_SIGNAL_KEYWORDS) * 2;

  // Sender patterns
  score += senderScore(sender);

  // Recency
  score += recencyScore(dateStr);

  // Reply chain depth
  score += replyChainScore(email);

  // Calendar mentions
  score += calendarMentionScore(searchable);

  // Gmail labels
  score += labelScore(email.labels);

  // Unread bonus — unread emails are slightly more urgent
  if (email.isUnread ?? email.unread) {
    score += 1;
  }

  return score;
}

function scoreToLevel(score: number): UrgencyLevel {
  if (score >= 6) return "high";
  if (score >= 2) return "medium";
  return "low";
}

// ── Public API ─────────────────────────────────────────────────────

export interface UrgencyResult {
  urgency: UrgencyLevel;
  score: number;
}

/**
 * Classify urgency for a single email using lightweight heuristics.
 */
export function classifyEmailUrgency(
  email: Record<string, unknown>,
): UrgencyResult {
  const score = computeScore(email as unknown as RawEmail);
  return { urgency: scoreToLevel(score), score };
}

/**
 * Classify urgency for a batch of emails. Returns results in the same order.
 */
export function classifyEmailBatch(
  emails: Record<string, unknown>[],
): UrgencyResult[] {
  return emails.map((email) => classifyEmailUrgency(email));
}
