import type { AgentOutput, PolicyDecision } from "@waibspace/types";
import {
  SurfaceFactory,
  type ApprovalSurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

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
      throw new Error(
        "ApprovalSurfaceAgent requires a PolicyDecision with approval_required verdict",
      );
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
    // Check prior outputs from safety agents
    for (const prior of input.priorOutputs) {
      if (prior.category === "safety" && prior.output) {
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
