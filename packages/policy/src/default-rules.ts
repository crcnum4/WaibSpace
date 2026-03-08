import type { PolicyRule } from "./types";

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  // Class A — auto-approve
  {
    id: "surface-compose",
    name: "Surface Composition",
    actionPattern: "surface.*",
    riskClass: "A",
    autoApprove: true,
    description: "All surface composition actions",
  },
  {
    id: "summarize",
    name: "Summarization",
    actionPattern: "summarize.*",
    riskClass: "A",
    autoApprove: true,
    description: "All summarization actions",
  },
  {
    id: "rank",
    name: "Ranking",
    actionPattern: "rank.*",
    riskClass: "A",
    autoApprove: true,
    description: "All ranking actions",
  },
  {
    id: "draft",
    name: "Draft Creation",
    actionPattern: "draft.*",
    riskClass: "A",
    autoApprove: true,
    description: "Draft creation",
  },
  {
    id: "fetch-data",
    name: "Data Fetch",
    actionPattern: "fetch.*",
    riskClass: "A",
    autoApprove: true,
    description: "Data retrieval operations",
  },

  // Class B — standing approval
  {
    id: "archive",
    name: "Archive",
    actionPattern: "archive.*",
    riskClass: "B",
    autoApprove: true,
    description: "Archive actions",
  },
  {
    id: "categorize",
    name: "Categorize",
    actionPattern: "categorize.*",
    riskClass: "B",
    autoApprove: true,
    description: "Categorization",
  },

  // Class C — require approval
  {
    id: "email-send",
    name: "Send Email",
    actionPattern: "email.send",
    riskClass: "C",
    autoApprove: false,
    description: "Sending emails requires approval",
  },
  {
    id: "calendar-create",
    name: "Create Calendar Event",
    actionPattern: "calendar.create",
    riskClass: "C",
    autoApprove: false,
    description: "Creating calendar events requires approval",
  },
  {
    id: "calendar-update",
    name: "Update Calendar Event",
    actionPattern: "calendar.update",
    riskClass: "C",
    autoApprove: false,
    description: "Updating calendar events requires approval",
  },
  {
    id: "post-public",
    name: "Public Post",
    actionPattern: "post.*",
    riskClass: "C",
    autoApprove: false,
    description: "Public posts require approval",
  },
];
