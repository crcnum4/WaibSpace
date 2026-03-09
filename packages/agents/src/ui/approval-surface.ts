import type { AgentOutput, PolicyDecision } from "@waibspace/types";
import {
  SurfaceFactory,
  type ApprovalSurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import { pendingActionStore } from "../execution/pending-action-store";

/**
 * Map action types (from PolicyGateAgent) to connector IDs and operations.
 *
 * Action types use a "service.verb" convention (e.g. "email.send",
 * "calendar.create"). This mapping translates them to the connector ID
 * and operation name that the connector understands.
 */
function resolveConnectorAction(
  actionType: string,
  context: Record<string, unknown>,
): { connectorId: string; operation: string; params: Record<string, unknown> } | undefined {
  if (actionType === "email.send") {
    return {
      connectorId: "gmail",
      operation: "send-email",
      params: {
        to: context.to ?? context.from,
        subject: context.subject,
        body: context.body ?? context.replyBody ?? context.draftBody,
        draftId: context.draftId,
        inReplyTo: context.inReplyTo ?? context.messageId,
      },
    };
  }

  if (actionType === "email.draft") {
    return {
      connectorId: "gmail",
      operation: "create-draft",
      params: {
        to: context.to ?? context.from,
        subject: context.subject,
        body: context.body ?? context.draftBody,
        inReplyTo: context.inReplyTo ?? context.messageId,
      },
    };
  }

  if (actionType === "calendar.create") {
    return {
      connectorId: "google-calendar",
      operation: "create-event",
      params: {
        summary: context.summary ?? context.title,
        start: context.start ?? context.startTime,
        end: context.end ?? context.endTime,
        description: context.description,
        attendees: context.attendees,
        location: context.location,
      },
    };
  }

  if (actionType === "calendar.update") {
    return {
      connectorId: "google-calendar",
      operation: "update-event",
      params: {
        eventId: context.eventId,
        updates: context.updates ?? context,
      },
    };
  }

  return undefined;
}

export class ApprovalSurfaceAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.approval-surface",
      name: "ApprovalSurfaceAgent",
      type: "surface-builder",
      category: "ui",
    });
  }

  async execute(
    input: AgentInput,
    _context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const policyDecision = this.findPolicyDecision(input);
    if (!policyDecision) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    this.log("Building approval surface", {
      action: policyDecision.action,
      riskClass: policyDecision.riskClass,
    });

    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const consequences = this.deriveConsequences(policyDecision);

    const surfaceData: ApprovalSurfaceData = {
      approvalId,
      actionDescription: policyDecision.requiredApproval?.prompt
        ?? `Action "${policyDecision.action}" requires your approval`,
      riskClass: policyDecision.riskClass,
      context: policyDecision.requiredApproval?.context ?? {
        action: policyDecision.action,
        reason: policyDecision.reason,
      },
      consequences,
    };

    // Store the pending action so the ActionExecutorAgent can execute it
    // when the user approves.
    const actionContext = (policyDecision.requiredApproval?.context ?? {}) as Record<string, unknown>;
    const resolved = resolveConnectorAction(policyDecision.action, actionContext);

    if (resolved) {
      pendingActionStore.set({
        approvalId,
        connectorId: resolved.connectorId,
        operation: resolved.operation,
        params: resolved.params,
        actionType: policyDecision.action,
        createdAt: Date.now(),
      });
      this.log("Stored pending action for approval", {
        approvalId,
        connectorId: resolved.connectorId,
        operation: resolved.operation,
      });
    } else {
      this.log("Could not resolve connector action for action type", {
        actionType: policyDecision.action,
        approvalId,
      });
    }

    const surfaceSpec = SurfaceFactory.approval(surfaceData);

    const endMs = Date.now();

    return {
      ...this.createOutput(
        { surfaceSpec },
        1.0,
        {
          sourceType: "system",
          sourceId: this.id,
          dataState: "raw",
          freshness: "realtime",
          timestamp: startMs,
        },
      ),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findPolicyDecision(
    input: AgentInput,
  ): PolicyDecision | undefined {
    // Check prior outputs from safety or context agents (PolicyGateAgent is context category)
    for (const prior of input.priorOutputs) {
      if ((prior.category === "safety" || prior.category === "context") && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if (
          "verdict" in output &&
          output["verdict"] === "approval_required" &&
          "riskClass" in output
        ) {
          return output as unknown as PolicyDecision;
        }
      }
    }

    // Check event payload directly
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (
      payload &&
      "verdict" in payload &&
      payload["verdict"] === "approval_required" &&
      "riskClass" in payload
    ) {
      return payload as unknown as PolicyDecision;
    }

    return undefined;
  }

  private deriveConsequences(decision: PolicyDecision): string[] {
    const consequences: string[] = [];

    consequences.push(
      `This action is classified as risk class ${decision.riskClass}`,
    );

    if (decision.reason) {
      consequences.push(decision.reason);
    }

    if (decision.riskClass === "C") {
      consequences.push(
        "This action may have significant or irreversible effects",
      );
    } else if (decision.riskClass === "B") {
      consequences.push(
        "This action will modify data or send communications on your behalf",
      );
    }

    return consequences;
  }
}
