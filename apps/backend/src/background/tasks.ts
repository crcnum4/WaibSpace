import type { BackgroundTask } from "./types";

export const MVP_BACKGROUND_TASKS: BackgroundTask[] = [
  {
    id: "morning-digest",
    name: "Morning Digest",
    description:
      "Proactive daily summary combining unread email highlights, urgent items, and today's calendar events. Runs once in the morning to prepare the dashboard digest card.",
    intervalMs: 24 * 60 * 60 * 1000, // every 24 hours (scheduled at ~7 AM via initial delay)
    enabled: true,
    allowedConnectors: ["gmail", "google-calendar"],
    actionClass: "A",
    outputTarget: "surface",
    maxRetries: 2,
    retryBackoffMs: 30_000,
  },
  {
    id: "inbox-summary",
    name: "Inbox Summary",
    description:
      "Summarize recent emails, classify urgency, and prepare draft surface",
    intervalMs: 4 * 60 * 60 * 1000, // every 4 hours
    enabled: true,
    allowedConnectors: ["gmail"],
    actionClass: "A",
    outputTarget: "surface",
    maxRetries: 2,
    retryBackoffMs: 10_000,
  },
  {
    id: "calendar-conflict-watch",
    name: "Calendar Conflict Watch",
    description: "Monitor for scheduling conflicts and surface warnings",
    intervalMs: 30 * 60 * 1000, // every 30 minutes
    enabled: true,
    allowedConnectors: ["google-calendar"],
    actionClass: "A",
    outputTarget: "surface",
    maxRetries: 2,
    retryBackoffMs: 5_000,
  },
  {
    id: "unanswered-messages",
    name: "Unanswered Important Messages",
    description: "Identify emails from important contacts with no reply",
    intervalMs: 2 * 60 * 60 * 1000, // every 2 hours
    enabled: true,
    allowedConnectors: ["gmail"],
    actionClass: "A",
    outputTarget: "surface",
    maxRetries: 2,
    retryBackoffMs: 10_000,
  },
];
