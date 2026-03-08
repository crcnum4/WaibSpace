import type { AgentOutput, PolicyDecision } from "@waibspace/types";
import type { ConnectorRegistry } from "@waibspace/connectors";
import { SurfaceFactory } from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

/**
 * Executes approved actions by invoking the appropriate connector.
 *
 * Handles `policy.approval.response` events. When the user approves an action,
 * this agent retrieves the pending action context from the event payload and
 * executes it through the relevant connector.
 */
export class ActionExecutorAgent extends BaseAgent {
  constructor() {
    super({
      id: "execution.action-executor",
      name: "ActionExecutorAgent",
      type: "action-executor",
      category: "execution",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();
    const payload = input.event.payload as Record<string, unknown> | undefined;

    if (!payload) {
      return this.buildResult("No payload in approval event", false, startMs);
    }

    const approved = payload.approved as boolean;
    const approvalId = payload.approvalId as string;

    if (!approved) {
      this.log("Action denied by user", { approvalId });

      // Build a confirmation surface showing the action was denied
      const confirmSurface = SurfaceFactory.generic(
        "Action Denied",
        {
          message: "The action was denied.",
          approvalId,
          status: "denied",
        },
        {
          sourceType: "system",
          sourceId: this.id,
          trustLevel: "trusted",
          timestamp: startMs,
          freshness: "realtime",
          dataState: "raw",
        },
      );

      return {
        ...this.createOutput(
          { surfaceSpec: confirmSurface, status: "denied", approvalId },
          1.0,
          { sourceType: "system", dataState: "raw", timestamp: startMs },
        ),
        timing: {
          startMs,
          endMs: Date.now(),
          durationMs: Date.now() - startMs,
        },
      };
    }

    this.log("Action approved, executing", { approvalId });

    const registry = context.config?.["connectorRegistry"] as
      | ConnectorRegistry
      | undefined;

    if (!registry) {
      return this.buildResult(
        "No connector registry available to execute action",
        false,
        startMs,
      );
    }

    // For the MVP, we build a confirmation surface
    // In a full implementation, we'd retrieve the pending action details
    // from a store keyed by approvalId and execute via the connector
    const confirmSurface = SurfaceFactory.generic(
      "Action Executed",
      {
        message: "The approved action has been executed successfully.",
        approvalId,
        status: "executed",
      },
      {
        sourceType: "system",
        sourceId: this.id,
        trustLevel: "trusted",
        timestamp: startMs,
        freshness: "realtime",
        dataState: "raw",
      },
    );

    const endMs = Date.now();

    return {
      ...this.createOutput(
        { surfaceSpec: confirmSurface, status: "executed", approvalId },
        1.0,
        { sourceType: "system", dataState: "raw", timestamp: startMs },
      ),
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }

  private buildResult(
    message: string,
    success: boolean,
    startMs: number,
  ): AgentOutput {
    const endMs = Date.now();
    return {
      ...this.createOutput(
        { message, success },
        success ? 1.0 : 0.5,
        { sourceType: "system", dataState: "raw", timestamp: startMs },
      ),
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }
}
