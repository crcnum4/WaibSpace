import type { BackgroundTask } from "./types";

export const MVP_BACKGROUND_TASKS: BackgroundTask[] = [
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
  },
];
