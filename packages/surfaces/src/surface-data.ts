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
    urgency: "high" | "medium" | "low";
    suggestedReply?: string;
  }>;
  totalCount: number;
  unreadCount: number;
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
