export interface ApprovalRecord {
  actionType: string;      // e.g., "email.send", "slack.reply"
  domain: string;          // e.g., "email:professional", "slack:work"
  approved: boolean;
  timestamp: number;
  /** Optional context about the specific action (e.g., recipient) */
  context?: Record<string, unknown>;
}

export interface ApprovalStats {
  actionType: string;
  domain: string;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  consecutiveApprovals: number;
  lastDecisionAt: number;
}

export interface TrustEscalation {
  actionType: string;
  domain: string;
  currentConsecutive: number;
  threshold: number;
  suggestion: string;       // Human-readable suggestion
  reasoning: string;
}
