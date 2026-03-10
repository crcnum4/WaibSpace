import type { MidTermMemory } from "@waibspace/memory";
import type { ApprovalTracker } from "./approval-tracker";
import type { TrustEscalation } from "./types";

export interface TrustRule {
  id: string;
  actionType: string;
  domain: string;
  autoApprove: boolean;
  createdAt: number;
  lastUsedAt: number;
  usageCount: number;
}

/**
 * Analyzes approval patterns from the ApprovalTracker and suggests
 * auto-approving similar actions after N consecutive approvals.
 *
 * Trust rules are persisted to mid-term memory so they survive restarts
 * and are available to the PolicyGateAgent for auto-approval decisions.
 */
export class EscalationEngine {
  private rules = new Map<string, TrustRule>();

  constructor(
    private tracker: ApprovalTracker,
    private midTerm: MidTermMemory,
  ) {
    this.loadRules();
  }

  /**
   * Check for escalation opportunities and return suggestions.
   * Filters out action+domain pairs that already have an active rule.
   */
  checkForEscalations(): TrustEscalation[] {
    return this.tracker.checkEscalations().filter((e) => {
      const ruleKey = `${e.actionType}:${e.domain}`;
      return !this.rules.has(ruleKey);
    });
  }

  /**
   * Accept an escalation — create an auto-approve rule.
   */
  acceptEscalation(actionType: string, domain: string): TrustRule {
    const ruleKey = `${actionType}:${domain}`;
    const rule: TrustRule = {
      id: ruleKey,
      actionType,
      domain,
      autoApprove: true,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      usageCount: 0,
    };
    this.rules.set(ruleKey, rule);
    this.persistRule(rule);
    return rule;
  }

  /**
   * Revoke an auto-approve rule.
   */
  revokeRule(actionType: string, domain: string): boolean {
    const ruleKey = `${actionType}:${domain}`;
    const deleted = this.rules.delete(ruleKey);
    if (deleted) {
      this.midTerm.store(
        "trust:rules",
        ruleKey,
        JSON.stringify({ revoked: true, revokedAt: Date.now() }),
      );
    }
    return deleted;
  }

  /**
   * Check if an action should be auto-approved based on trust rules.
   * Updates usage stats when a rule is applied.
   */
  shouldAutoApprove(actionType: string, domain: string): boolean {
    const ruleKey = `${actionType}:${domain}`;
    const rule = this.rules.get(ruleKey);
    if (!rule || !rule.autoApprove) return false;

    rule.lastUsedAt = Date.now();
    rule.usageCount++;
    this.persistRule(rule);
    return true;
  }

  /** Get all active (non-revoked) rules. */
  getActiveRules(): TrustRule[] {
    return [...this.rules.values()].filter((r) => r.autoApprove);
  }

  private persistRule(rule: TrustRule): void {
    this.midTerm.store("trust:rules", rule.id, JSON.stringify(rule));
  }

  private loadRules(): void {
    const entries = this.midTerm.getByDomain("trust:rules");
    for (const entry of entries) {
      try {
        const parsed = JSON.parse(entry.summary) as Record<string, unknown>;
        // Skip revoked rules
        if (parsed.revoked) continue;

        const rule: TrustRule = {
          id: (parsed.id as string) ?? entry.key,
          actionType: parsed.actionType as string,
          domain: parsed.domain as string,
          autoApprove: parsed.autoApprove as boolean,
          createdAt: parsed.createdAt as number,
          lastUsedAt: parsed.lastUsedAt as number,
          usageCount: parsed.usageCount as number,
        };

        if (rule.actionType && rule.domain && rule.autoApprove) {
          this.rules.set(rule.id, rule);
        }
      } catch {
        // Skip entries that can't be parsed
      }
    }
  }
}
