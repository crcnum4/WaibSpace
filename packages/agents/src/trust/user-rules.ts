import type { LongTermMemory } from "@waibspace/memory";
import type { MidTermMemory } from "@waibspace/memory";

export interface UserTrustRule {
  id: string;
  description: string; // Human-readable: "Always reply to boss with acknowledgment"
  actionType: string; // e.g., "email.send"
  domain: string; // e.g., "email:professional"
  condition?: {
    sender?: string; // e.g., "boss@company.com"
    topic?: string; // e.g., "status update"
  };
  autoApprove: boolean;
  createdAt: number;
  lastUsedAt: number;
}

export interface CorrectionFeedback {
  actionType: string;
  domain: string;
  correctionType: "edited" | "rejected" | "modified";
  originalContent?: string;
  correctedContent?: string;
  timestamp: number;
}

const RULES_DOMAIN = "trust:user-rules";
const CORRECTIONS_DOMAIN = "trust:corrections";

/**
 * Manages user-defined trust rules and correction feedback.
 *
 * Rules are persisted in LongTermMemory (survive indefinitely).
 * Corrections are stored in MidTermMemory (decay over time, reflecting
 * that recent corrections matter more than old ones).
 */
export class UserRulesManager {
  constructor(
    private longTerm: LongTermMemory,
    private midTerm: MidTermMemory,
  ) {}

  /**
   * Add a user-defined trust rule.
   * Stored in long-term memory with searchable keywords.
   */
  addRule(
    rule: Omit<UserTrustRule, "id" | "createdAt" | "lastUsedAt">,
  ): UserTrustRule {
    const fullRule: UserTrustRule = {
      ...rule,
      id: `user-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    // Build keywords including the rule ID so each rule gets a unique
    // LongTermMemory entry (ID is derived from domain + sorted keywords).
    const keywords = [fullRule.id, rule.actionType, rule.domain];
    if (rule.condition?.sender) keywords.push(rule.condition.sender);
    if (rule.condition?.topic) keywords.push(rule.condition.topic);

    this.longTerm.store(RULES_DOMAIN, keywords, JSON.stringify(fullRule));
    return fullRule;
  }

  /**
   * Check if any user rule matches the given action.
   * Returns the first matching auto-approve rule, or null.
   */
  checkRules(
    actionType: string,
    domain: string,
    context?: Record<string, unknown>,
  ): UserTrustRule | null {
    // Retrieve all rules for the trust:user-rules domain.
    // Use a generous limit since users are unlikely to have hundreds of rules.
    const entries = this.longTerm.recallByDomain(RULES_DOMAIN, undefined, 100);

    for (const entry of entries) {
      try {
        const rule = JSON.parse(entry.blurb) as UserTrustRule;

        // Skip deleted/disabled rules
        if (!rule.autoApprove) continue;

        // Match action type exactly
        if (rule.actionType !== actionType) continue;

        // Match domain exactly or as prefix (e.g., rule for "email" matches "email:professional")
        if (rule.domain !== domain && !domain.startsWith(rule.domain)) continue;

        // Check optional conditions
        if (rule.condition?.sender && context?.sender) {
          if (
            !String(context.sender)
              .toLowerCase()
              .includes(rule.condition.sender.toLowerCase())
          ) {
            continue;
          }
        }

        if (rule.condition?.topic && context?.topic) {
          if (
            !String(context.topic)
              .toLowerCase()
              .includes(rule.condition.topic.toLowerCase())
          ) {
            continue;
          }
        }

        return rule;
      } catch {
        // Corrupt entry — skip
        continue;
      }
    }

    return null;
  }

  /**
   * List all active user-defined rules.
   */
  listRules(): UserTrustRule[] {
    const entries = this.longTerm.recallByDomain(RULES_DOMAIN, undefined, 100);
    const rules: UserTrustRule[] = [];

    for (const entry of entries) {
      try {
        const rule = JSON.parse(entry.blurb) as UserTrustRule;
        if (rule.autoApprove) {
          rules.push(rule);
        }
      } catch {
        continue;
      }
    }

    return rules;
  }

  /**
   * Remove a user-defined rule by ID.
   *
   * Since LongTermMemory does not expose a delete method, we overwrite the
   * entry with autoApprove set to false. The checkRules method filters these
   * out, effectively disabling the rule.
   */
  removeRule(ruleId: string): boolean {
    const entries = this.longTerm.recallByDomain(RULES_DOMAIN, undefined, 100);

    for (const entry of entries) {
      try {
        const rule = JSON.parse(entry.blurb) as UserTrustRule;
        if (rule.id === ruleId) {
          // Overwrite with autoApprove disabled — effectively a soft delete
          const disabledRule: UserTrustRule = { ...rule, autoApprove: false };
          this.longTerm.store(
            RULES_DOMAIN,
            entry.keywords,
            JSON.stringify(disabledRule),
          );
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Record a correction — user edited or rejected an autonomous action.
   * Stored in mid-term memory so recent corrections carry more weight
   * (relevance decays over time).
   */
  recordCorrection(feedback: CorrectionFeedback): void {
    const key = `${feedback.actionType}:${feedback.domain}:${feedback.timestamp}`;
    const summary = `User ${feedback.correctionType} ${feedback.actionType} for ${feedback.domain} at ${new Date(feedback.timestamp).toISOString()}`;
    this.midTerm.store(CORRECTIONS_DOMAIN, key, summary);
  }

  /**
   * Get recent corrections for a given action type and domain.
   * Useful for determining if trust should be reduced.
   */
  getCorrections(actionType: string, domain: string): number {
    const entries = this.midTerm.getByDomain(CORRECTIONS_DOMAIN);
    return entries.filter((e) =>
      e.key.startsWith(`${actionType}:${domain}`),
    ).length;
  }

  /**
   * Determine if an action should be downgraded from auto-approve
   * based on recent correction patterns.
   *
   * If the user has corrected an action type 3+ times recently,
   * the trust is considered degraded and auto-approve should not apply.
   */
  isTrustDegraded(actionType: string, domain: string): boolean {
    const correctionCount = this.getCorrections(actionType, domain);
    return correctionCount >= 3;
  }

  /**
   * Get trust stats for dashboard display.
   */
  getTrustStats(): {
    activeRules: number;
    recentCorrections: number;
  } {
    const rules = this.listRules();
    const corrections = this.midTerm.getByDomain(CORRECTIONS_DOMAIN);

    return {
      activeRules: rules.length,
      recentCorrections: corrections.length,
    };
  }
}
