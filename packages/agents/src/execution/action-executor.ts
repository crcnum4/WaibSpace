import type { AgentOutput } from "@waibspace/types";
import type { ConnectorRegistry, ConnectorAction } from "@waibspace/connectors";
import { SurfaceFactory } from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import { pendingActionStore } from "./pending-action-store";

/**
 * Executes approved actions by invoking the appropriate connector.
 *
 * Handles `policy.approval.response` events. When the user approves an action,
 * this agent retrieves the pending action from the store (keyed by approvalId)
 * and executes it through the relevant connector.
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

      // Clean up the pending action
      pendingActionStore.remove(approvalId);

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

    // Look up the pending action stored when the approval surface was created
    const pendingAction = pendingActionStore.get(approvalId);

    if (!pendingAction) {
      this.log("No pending action found for approvalId", { approvalId });
      return this.buildResult(
        `No pending action found for approval "${approvalId}". It may have expired.`,
        false,
        startMs,
      );
    }

    // Remove from store now that we're executing (prevents duplicate execution)
    pendingActionStore.remove(approvalId);

    // Look up the connector
    const connector = registry.get(pendingAction.connectorId);

    if (!connector) {
      this.log("Connector not found", {
        connectorId: pendingAction.connectorId,
        approvalId,
      });
      return this.buildResult(
        `Connector "${pendingAction.connectorId}" not found in registry`,
        false,
        startMs,
      );
    }

    // Build the ConnectorAction with an approved policy decision
    const connectorAction: ConnectorAction = {
      operation: pendingAction.operation,
      params: pendingAction.params,
      policyDecision: {
        action: pendingAction.actionType,
        riskClass: "C",
        verdict: "approved",
        reason: `User approved action (approvalId: ${approvalId})`,
      },
      traceId: context.traceId,
    };

    this.log("Executing action via connector", {
      connectorId: pendingAction.connectorId,
      operation: pendingAction.operation,
      approvalId,
    });

    try {
      const result = await connector.execute(connectorAction);

      if (!result.success) {
        this.log("Connector execution failed", {
          approvalId,
          error: result.error,
        });

        const errorSurface = SurfaceFactory.generic(
          "Action Failed",
          {
            message: result.error ?? "The action could not be completed.",
            approvalId,
            status: "error",
            operation: pendingAction.operation,
            connectorId: pendingAction.connectorId,
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
            { surfaceSpec: errorSurface, status: "error", approvalId, error: result.error },
            0.5,
            { sourceType: "system", dataState: "raw", timestamp: startMs },
          ),
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }

      this.log("Action executed successfully", {
        approvalId,
        result: result.result,
      });

      const successSurface = SurfaceFactory.generic(
        "Action Executed",
        {
          message: this.describeSuccess(pendingAction.operation, result.result),
          approvalId,
          status: "executed",
          operation: pendingAction.operation,
          connectorId: pendingAction.connectorId,
          result: result.result,
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
          { surfaceSpec: successSurface, status: "executed", approvalId },
          1.0,
          { sourceType: "system", dataState: "raw", timestamp: startMs },
        ),
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.log("Connector execution threw an error", {
        approvalId,
        error: errorMsg,
      });

      const errorSurface = SurfaceFactory.generic(
        "Action Failed",
        {
          message: `An unexpected error occurred: ${errorMsg}`,
          approvalId,
          status: "error",
          operation: pendingAction.operation,
          connectorId: pendingAction.connectorId,
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
          { surfaceSpec: errorSurface, status: "error", approvalId, error: errorMsg },
          0.5,
          { sourceType: "system", dataState: "raw", timestamp: startMs },
        ),
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }
  }

  /**
   * Generate a human-readable success message based on the operation.
   */
  private describeSuccess(operation: string, result: unknown): string {
    const r = result as Record<string, unknown> | undefined;

    switch (operation) {
      case "send-email": {
        const messageId = r?.messageId ?? "unknown";
        return `Email sent successfully (message ID: ${messageId}).`;
      }
      case "create-draft": {
        const draftId = r?.draftId ?? "unknown";
        return `Draft created successfully (draft ID: ${draftId}).`;
      }
      case "create-event": {
        const summary = r?.summary ?? (r as Record<string, unknown>)?.summary ?? "event";
        return `Calendar event "${summary}" created successfully.`;
      }
      case "update-event": {
        return "Calendar event updated successfully.";
      }
      default:
        return "The approved action has been executed successfully.";
    }
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
