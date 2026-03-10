import type { MidTermMemory } from "@waibspace/memory";
import type { ApprovalRecord, ApprovalStats, TrustEscalation } from "./types";

export class ApprovalTracker {
  private records: ApprovalRecord[] = [];
  private readonly maxRecords = 500;
  private readonly escalationThreshold = 5; // consecutive approvals needed

  constructor(private midTerm: MidTermMemory) {}

  /**
   * Record an approval or rejection decision.
   */
  recordDecision(record: ApprovalRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    // Persist stats to mid-term memory
    const stats = this.getStats(record.actionType, record.domain);
    this.midTerm.store(
      "trust:approvals",
      `${record.actionType}:${record.domain}`,
      JSON.stringify(stats),
    );
  }

  /**
   * Get approval stats for a specific action type and domain.
   */
  getStats(actionType: string, domain: string): ApprovalStats {
    const relevant = this.records.filter(
      (r) => r.actionType === actionType && r.domain === domain,
    );

    // Count consecutive approvals from the end
    let consecutive = 0;
    for (let i = relevant.length - 1; i >= 0; i--) {
      if (relevant[i].approved) consecutive++;
      else break;
    }

    return {
      actionType,
      domain,
      totalCount: relevant.length,
      approvedCount: relevant.filter((r) => r.approved).length,
      rejectedCount: relevant.filter((r) => !r.approved).length,
      consecutiveApprovals: consecutive,
      lastDecisionAt:
        relevant.length > 0 ? relevant[relevant.length - 1].timestamp : 0,
    };
  }

  /**
   * Check if any action+domain pair qualifies for trust escalation.
   */
  checkEscalations(): TrustEscalation[] {
    // Group records by actionType + domain, check each for threshold
    const pairs = new Map<string, { actionType: string; domain: string }>();
    for (const r of this.records) {
      pairs.set(`${r.actionType}:${r.domain}`, {
        actionType: r.actionType,
        domain: r.domain,
      });
    }

    const escalations: TrustEscalation[] = [];
    for (const { actionType, domain } of pairs.values()) {
      const stats = this.getStats(actionType, domain);
      if (stats.consecutiveApprovals >= this.escalationThreshold) {
        escalations.push({
          actionType,
          domain,
          currentConsecutive: stats.consecutiveApprovals,
          threshold: this.escalationThreshold,
          suggestion: `Auto-approve "${actionType}" for ${domain}?`,
          reasoning: `${stats.consecutiveApprovals} consecutive approvals without changes`,
        });
      }
    }
    return escalations;
  }

  /** Get all tracked stats. */
  getAllStats(): ApprovalStats[] {
    const pairs = new Map<string, { actionType: string; domain: string }>();
    for (const r of this.records) {
      pairs.set(`${r.actionType}:${r.domain}`, {
        actionType: r.actionType,
        domain: r.domain,
      });
    }
    return [...pairs.values()].map((p) =>
      this.getStats(p.actionType, p.domain),
    );
  }
}
