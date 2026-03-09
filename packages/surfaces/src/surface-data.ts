import type { SurfaceAction, RiskClass } from "@waibspace/types";
import type { ProvenanceMetadata } from "@waibspace/types";

export interface InboxSurfaceData {
  emails: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    isUnread: boolean;
    urgency?: "high" | "medium" | "low";
    suggestedReply?: string;
  }>;
  totalCount: number;
  unreadCount: number;
  /** True when the email list was truncated to fit within limits */
  isTruncated?: boolean;
  /** Original email count before truncation */
  fullCount?: number;
  /** Present when data retrieval failed (e.g. Gmail API timeout) */
  error?: string;
}

export interface CalendarSurfaceData {
  events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    attendees?: string[];
    conflictWith?: string;
  }>;
  freeSlots: Array<{ start: string; end: string }>;
  dateRange: { start: string; end: string };
}

export interface DiscoverySurfaceData {
  query: string;
  results: Array<{
    title: string;
    description: string;
    url?: string;
    relevanceScore: number;
    matchReasons: string[];
    actions?: SurfaceAction[];
  }>;
  sources: ProvenanceMetadata[];
}

export interface ApprovalSurfaceData {
  approvalId: string;
  actionDescription: string;
  riskClass: RiskClass;
  context: unknown;
  consequences: string[];
}

export interface MorningDigestSurfaceData {
  /** ISO date string for the digest (e.g. "2026-03-09") */
  date: string;
  /** Summary line for the digest card header */
  greeting: string;
  inbox: {
    unreadCount: number;
    urgentEmails: Array<{
      id: string;
      from: string;
      subject: string;
      snippet: string;
      urgency: "high" | "medium";
    }>;
  };
  calendar: {
    eventCount: number;
    events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      location?: string;
    }>;
  };
  suggestedActions: Array<{
    id: string;
    label: string;
    reason: string;
    actionType: string;
    payload?: Record<string, unknown>;
  }>;
  /** When the digest was generated (ISO timestamp) */
  generatedAt: string;
}

export interface ConnectionGuideSurfaceData {
  step: "browse" | "credentials" | "connecting" | "success" | "error";
  message: string;
  availableServices: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    categories: string[];
  }>;
  selectedService?: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
  credentialFields?: Array<{
    key: string;
    label: string;
    helpText: string;
    helpUrl?: string;
    sensitive: boolean;
  }>;
  discoveredTools?: Array<{ name: string; description?: string }>;
  errorDetail?: string;
}
