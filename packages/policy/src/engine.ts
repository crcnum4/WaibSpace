import type { PolicyDecision } from "@waibspace/types";
import type { PolicyRule, ProposedAction, PolicyCondition } from "./types";

/**
 * Match an action type against a simple glob pattern.
 * Supports `*` as a wildcard for any sequence of characters.
 * e.g. "surface.*" matches "surface.compose", "email.send" matches exactly.
 */
function matchPattern(pattern: string, actionType: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("^" + escaped.replace(/\*/g, ".*") + "$");
  return regex.test(actionType);
}

function evaluateCondition(
  condition: PolicyCondition,
  action: ProposedAction,
): boolean {
  const value = (action as unknown as Record<string, unknown>)[condition.field];

  switch (condition.operator) {
    case "eq":
      return value === condition.value;
    case "neq":
      return value !== condition.value;
    case "gt":
      return typeof value === "number" && value > (condition.value as number);
    case "lt":
      return typeof value === "number" && value < (condition.value as number);
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(value);
    default:
      return false;
  }
}

export class PolicyEngine {
  private rules: Map<string, PolicyRule>;

  constructor(rules?: PolicyRule[]) {
    this.rules = new Map();
    if (rules) {
      for (const rule of rules) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  evaluate(action: ProposedAction): PolicyDecision {
    const matchingRules = Array.from(this.rules.values()).filter((rule) =>
      matchPattern(rule.actionPattern, action.actionType),
    );

    // No matching rules — default to Class C for safety
    if (matchingRules.length === 0) {
      return {
        action: action.actionType,
        riskClass: "C",
        verdict: "approval_required",
        reason: "No matching policy rule found; defaulting to approval required",
        requiredApproval: {
          prompt: `Approve action "${action.actionType}"?`,
          context: action.payload,
        },
      };
    }

    // Use the first matching rule (most specific rules should be added first)
    const rule = matchingRules[0];

    // Evaluate conditions if present
    if (rule.conditions && rule.conditions.length > 0) {
      const allConditionsMet = rule.conditions.every((condition) =>
        evaluateCondition(condition, action),
      );
      if (!allConditionsMet) {
        return {
          action: action.actionType,
          riskClass: "C",
          verdict: "approval_required",
          reason: `Conditions not met for rule "${rule.name}"`,
          requiredApproval: {
            prompt: `Approve action "${action.actionType}"?`,
            context: action.payload,
          },
        };
      }
    }

    // Auto-approve or Class A/B
    if (rule.autoApprove || rule.riskClass === "A" || rule.riskClass === "B") {
      return {
        action: action.actionType,
        riskClass: rule.riskClass,
        verdict: "approved",
        reason: rule.description,
      };
    }

    // Class C — require approval
    return {
      action: action.actionType,
      riskClass: rule.riskClass,
      verdict: "approval_required",
      reason: rule.description,
      requiredApproval: {
        prompt: `Approve action "${action.actionType}"?`,
        context: action.payload,
      },
    };
  }

  addRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  getRules(): PolicyRule[] {
    return Array.from(this.rules.values());
  }
}
