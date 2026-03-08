import type { AgentOutput, PolicyDecision } from "@waibspace/types";
import type { PolicyEngine, ProposedAction } from "@waibspace/policy";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

/**
 * Evaluates proposed actions against the PolicyEngine during the context phase.
 *
 * When a user interaction implies an action (e.g., "send-reply" maps to "email.send"),
 * this agent evaluates it through the PolicyEngine and outputs a PolicyDecision.
 * Downstream UI agents (like ApprovalSurfaceAgent) use this decision to show
 * approval surfaces when required.
 */
export class PolicyGateAgent extends BaseAgent {
  constructor() {
    super({
      id: "context.policy-gate",
      name: "PolicyGateAgent",
      type: "policy-evaluator",
      category: "context",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const policyEngine = context.config?.["policyEngine"] as
      | PolicyEngine
      | undefined;

    if (!policyEngine) {
      this.log("No PolicyEngine in context — skipping policy evaluation");
      return this.createOutput(
        { skipped: true, reason: "No PolicyEngine available" },
        1.0,
        { dataState: "raw", timestamp: startMs },
      );
    }

    // Detect if this event implies a policy-relevant action
    const detected = this.detectProposedAction(input);
    if (!detected) {
      this.log("No policy-relevant action detected");
      return this.createOutput(
        { skipped: true, reason: "No policy-relevant action" },
        1.0,
        { dataState: "raw", timestamp: startMs },
      );
    }

    const proposedAction: ProposedAction = {
      actionType: detected.actionType,
      payload: detected.payload,
      agentId: this.id,
      traceId: context.traceId,
    };

    this.log("Evaluating action through policy engine", {
      actionType: proposedAction.actionType,
    });

    const decision = policyEngine.evaluate(proposedAction);

    // Enrich the approval prompt with action context
    if (decision.verdict === "approval_required" && decision.requiredApproval) {
      decision.requiredApproval.context = detected.payload;
      if (detected.actionType === "email.send") {
        const ctx = detected.payload as Record<string, unknown> | undefined;
        const to = ctx?.from ?? ctx?.to ?? "recipient";
        const subject = ctx?.subject ?? "unknown subject";
        decision.requiredApproval.prompt =
          `Send email reply to ${to} regarding "${subject}"?`;
      }
    }

    this.log("Policy decision", {
      action: decision.action,
      verdict: decision.verdict,
      riskClass: decision.riskClass,
    });

    const endMs = Date.now();

    return {
      ...this.createOutput(decision, 1.0, {
        sourceType: "system",
        sourceId: this.id,
        dataState: "raw",
        freshness: "realtime",
        timestamp: startMs,
      }),
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }

  private detectProposedAction(
    input: AgentInput,
  ): { actionType: string; payload: unknown } | undefined {
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (!payload) return undefined;

    // Direct action type from interaction context
    const interactionContext = payload.context as Record<string, unknown> | undefined;
    if (interactionContext?.actionType) {
      return {
        actionType: interactionContext.actionType as string,
        payload: interactionContext,
      };
    }

    // Map known interactions to action types
    const interaction = payload.interaction as string | undefined;
    if (interaction === "send-reply") {
      return {
        actionType: "email.send",
        payload: interactionContext ?? payload,
      };
    }

    // Check reasoning outputs for action suggestions
    for (const prior of input.priorOutputs) {
      if (prior.category === "reasoning" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if (output.actionToTake) {
          const action = output.actionToTake as string;
          // Only gate actions that are known to be policy-relevant
          if (
            action.startsWith("email.send") ||
            action.startsWith("calendar.create") ||
            action.startsWith("calendar.update") ||
            action.startsWith("post.")
          ) {
            return { actionType: action, payload: output };
          }
        }
      }
    }

    return undefined;
  }
}
