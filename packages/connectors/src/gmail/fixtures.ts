import type { EmailSummary } from "./types";

/**
 * Generate realistic fixture emails with dates relative to now.
 * Called once at import time so timestamps stay fresh.
 */
function generateFixtureEmails(): EmailSummary[] {
  const now = Date.now();
  const minutes = (n: number) => n * 60_000;
  const hours = (n: number) => n * 3_600_000;
  const days = (n: number) => n * 86_400_000;

  const d = (offset: number) => new Date(now - offset).toUTCString();

  return [
    // ── High urgency (3) ────────────────────────────────────
    {
      id: "mock-001",
      threadId: "thread-001",
      from: "Sarah Chen <sarah.chen@company.com>",
      to: "me@company.com",
      subject: "URGENT: Production deploy approval needed by EOD",
      snippet: "Hey, the release is blocked until you sign off on the deploy checklist. Can you review the PR and approve before 5pm?",
      date: d(minutes(12)),
      labels: ["INBOX", "UNREAD", "IMPORTANT"],
      isUnread: true,
    },
    {
      id: "mock-002",
      threadId: "thread-002",
      from: "David Park <david.park@company.com>",
      to: "me@company.com",
      subject: "Re: Client escalation — Acme Corp data issue",
      snippet: "The client is asking for an update by noon tomorrow. I've narrowed it down to the sync job but need your help debugging the transform step.",
      date: d(hours(1)),
      labels: ["INBOX", "UNREAD", "IMPORTANT"],
      isUnread: true,
    },
    {
      id: "mock-003",
      threadId: "thread-003",
      from: "Maria Lopez <maria.lopez@company.com>",
      to: "me@company.com",
      subject: "Action required: Q1 budget sign-off before Friday",
      snippet: "Finance needs your department budget approved in the portal by end of week. I've pre-filled most of it — just needs your sign-off.",
      date: d(hours(3)),
      labels: ["INBOX", "UNREAD"],
      isUnread: true,
    },

    // ── Medium urgency (7) ──────────────────────────────────
    {
      id: "mock-004",
      threadId: "thread-004",
      from: "James Wilson <james.wilson@company.com>",
      to: "me@company.com",
      subject: "Design review notes from yesterday's session",
      snippet: "Attached are the consolidated notes from the design review. Key takeaway: we're moving forward with option B for the nav redesign.",
      date: d(hours(5)),
      labels: ["INBOX", "UNREAD"],
      isUnread: true,
    },
    {
      id: "mock-005",
      threadId: "thread-005",
      from: "Priya Sharma <priya.sharma@company.com>",
      to: "me@company.com",
      subject: "Sprint retro summary + action items",
      snippet: "Here's what we agreed on: 1) Reduce WIP limit to 3, 2) Add integration test step to definition of done, 3) Rotate on-call weekly.",
      date: d(hours(8)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-006",
      threadId: "thread-006",
      from: "Alex Nguyen <alex.nguyen@company.com>",
      to: "me@company.com",
      subject: "Re: API rate limiting strategy",
      snippet: "I like the token bucket approach. I've pushed a draft implementation to the feature branch — take a look when you get a chance.",
      date: d(hours(10)),
      labels: ["INBOX", "UNREAD"],
      isUnread: true,
    },
    {
      id: "mock-007",
      threadId: "thread-007",
      from: "Rachel Kim <rachel.kim@company.com>",
      to: "me@company.com",
      subject: "Onboarding doc updates for new hires",
      snippet: "I've updated the onboarding guide with the new dev environment setup steps. Could you review the Docker section when you have time?",
      date: d(days(1)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-008",
      threadId: "thread-008",
      from: "Tom Baker <tom.baker@partner.io>",
      to: "me@company.com",
      subject: "Partnership integration timeline",
      snippet: "Following up on our call — here's the proposed timeline for the API integration. We're targeting a soft launch in mid-April.",
      date: d(days(1) + hours(4)),
      labels: ["INBOX", "UNREAD"],
      isUnread: true,
    },
    {
      id: "mock-009",
      threadId: "thread-009",
      from: "HR Team <hr@company.com>",
      to: "all-staff@company.com",
      subject: "Updated PTO policy effective next month",
      snippet: "Please review the updated PTO policy document. Key change: rollover limit increased to 10 days. Full details in the attached PDF.",
      date: d(days(2)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-010",
      threadId: "thread-010",
      from: "Emily Foster <emily.foster@company.com>",
      to: "me@company.com",
      subject: "Quarterly all-hands slides — feedback welcome",
      snippet: "Draft slides for next week's all-hands are in the shared drive. Would love feedback on the product roadmap section by Thursday.",
      date: d(days(2) + hours(6)),
      labels: ["INBOX"],
      isUnread: false,
    },

    // ── Low urgency (10) ────────────────────────────────────
    {
      id: "mock-011",
      threadId: "thread-011",
      from: "GitHub <notifications@github.com>",
      to: "me@company.com",
      subject: "[waibspace/core] PR #142: Fix flaky integration test",
      snippet: "dependabot[bot] opened a pull request: Bump vitest from 1.5.0 to 1.6.1. This includes a fix for the occasional test timeout issue.",
      date: d(hours(2)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-012",
      threadId: "thread-012",
      from: "Vercel <notifications@vercel.com>",
      to: "me@company.com",
      subject: "Deployment successful: waibspace-frontend (preview)",
      snippet: "Your deployment to preview has completed successfully. Preview URL: https://waibspace-frontend-abc123.vercel.app",
      date: d(hours(4)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-013",
      threadId: "thread-013",
      from: "Stripe <receipts@stripe.com>",
      to: "me@company.com",
      subject: "Your receipt from Stripe — Invoice #INV-2024-0892",
      snippet: "Payment of $49.00 received for Stripe Developer Pro plan. Next billing date: April 9, 2026.",
      date: d(days(1) + hours(2)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-014",
      threadId: "thread-014",
      from: "The Pragmatic Engineer <newsletter@pragmaticengineer.com>",
      to: "me@company.com",
      subject: "Issue #198: The state of frontend tooling in 2026",
      snippet: "This week: Vite 7 deep-dive, the React Server Components ecosystem matures, and why Bun is winning the bundler war.",
      date: d(days(1) + hours(8)),
      labels: ["INBOX", "CATEGORY_PROMOTIONS"],
      isUnread: false,
    },
    {
      id: "mock-015",
      threadId: "thread-015",
      from: "Linear <notifications@linear.app>",
      to: "me@company.com",
      subject: "3 issues assigned to you this week",
      snippet: "You have 3 new issues assigned: WAIB-301 (Mock Gmail connector), WAIB-298 (Perf audit), WAIB-295 (Auth flow update).",
      date: d(days(2) + hours(1)),
      labels: ["INBOX", "UNREAD"],
      isUnread: true,
    },
    {
      id: "mock-016",
      threadId: "thread-016",
      from: "Slack <notification@slack.com>",
      to: "me@company.com",
      subject: "New messages in #engineering (3 unread)",
      snippet: "You have unread messages in #engineering. Sarah Chen mentioned you: 'Can someone review the migration script before we merge?'",
      date: d(days(2) + hours(5)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-017",
      threadId: "thread-017",
      from: "AWS <no-reply@amazonaws.com>",
      to: "me@company.com",
      subject: "AWS Monthly Cost Report — February 2026",
      snippet: "Your estimated charges for February 2026: $1,247.83. This is a 3% decrease from last month. Top service: EC2 ($542.10).",
      date: d(days(3)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-018",
      threadId: "thread-018",
      from: "Dev.to Weekly <digest@dev.to>",
      to: "me@company.com",
      subject: "Top posts this week: TypeScript 6.0 features, AI coding assistants",
      snippet: "Trending: 'Why TypeScript 6.0 changes everything' (4.2k reactions), 'Building an AI agent from scratch' (3.8k reactions).",
      date: d(days(3) + hours(6)),
      labels: ["INBOX", "CATEGORY_PROMOTIONS"],
      isUnread: false,
    },
    {
      id: "mock-019",
      threadId: "thread-019",
      from: "Figma <no-reply@figma.com>",
      to: "me@company.com",
      subject: "Rachel Kim commented on 'WaibSpace Dashboard v2'",
      snippet: "Rachel Kim left a comment: 'Love the new card layout! Can we make the urgency indicator slightly more prominent?'",
      date: d(days(4)),
      labels: ["INBOX"],
      isUnread: false,
    },
    {
      id: "mock-020",
      threadId: "thread-020",
      from: "Google Cloud <cloud-noreply@google.com>",
      to: "me@company.com",
      subject: "Your Google Cloud free trial credits are expiring soon",
      snippet: "Your $300 free trial credits will expire in 14 days. Upgrade to a paid account to continue using Google Cloud services.",
      date: d(days(5)),
      labels: ["INBOX", "CATEGORY_PROMOTIONS"],
      isUnread: false,
    },
  ];
}

/** 20 realistic fixture emails, generated with timestamps relative to now. */
export const FIXTURE_EMAILS: EmailSummary[] = generateFixtureEmails();

/**
 * Full email bodies keyed by email id.
 * Used by the get-email operation to return richer content.
 */
export const FIXTURE_BODIES: Record<string, string> = {
  "mock-001":
    "Hey,\n\nThe release is blocked until you sign off on the deploy checklist. The PR is here: https://github.com/waibspace/core/pull/158\n\nWe need your approval before 5pm today so we can push to production tonight during the maintenance window.\n\nThanks,\nSarah",
  "mock-002":
    "Hi,\n\nThe client is asking for an update by noon tomorrow. I've narrowed the issue down to the sync job — specifically the transform step that maps their custom fields.\n\nCan you hop on a quick call this afternoon to look at it together? I've set up a debug environment at staging-acme.waibspace.dev.\n\nThanks,\nDavid",
  "mock-003":
    "Hi,\n\nFinance needs your department budget approved in the portal by end of week. I've pre-filled most of the line items based on last quarter's actuals.\n\nPlease review and submit at: https://finance.company.com/budgets/q1-2026\n\nLet me know if you have questions.\n\nBest,\nMaria",
};
