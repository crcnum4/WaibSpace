import type { AgentOutput, IPendingActionStore } from "@waibspace/types";
import type { ConnectorRegistry, ConnectorAction } from "@waibspace/connectors";
import { SurfaceFactory } from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { ApprovalTracker } from "../trust";

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

    const pendingActionStore = context.config?.["pendingActionStore"] as
      | IPendingActionStore
      | undefined;

    // Look up the pending action from the store
    const pendingAction = pendingActionStore?.get(approvalId);
    if (pendingAction) {
      this.log("Found pending action in store", {
        approvalId,
        actionType: pendingAction.actionType,
        riskClass: pendingAction.riskClass,
      });
    } else {
      this.log("No pending action found in store", { approvalId });
    }

    if (!approved) {
      this.log("Action denied by user", { approvalId });

      // Update the store lifecycle
      try {
        pendingActionStore?.deny(approvalId, "Denied by user");
      } catch {
        // Store update failure is non-critical
      }

      // Track the rejection decision
      this.trackDecision(context, pendingAction, false);

      const confirmSurface = SurfaceFactory.generic(
        "Action Denied",
        {
          message: "The action was denied.",
          approvalId,
          actionType: pendingAction?.actionType,
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

    // Transition to approved in the store
    try {
      pendingActionStore?.approve(approvalId);
    } catch {
      // Store update failure is non-critical
    }

    const registry = context.config?.["connectorRegistry"] as
      | ConnectorRegistry
      | undefined;

    if (!registry) {
      try {
        pendingActionStore?.markFailed(approvalId, "No connector registry available");
      } catch {
        // non-critical
      }
      return this.buildResult(
        "No connector registry available to execute action",
        false,
        startMs,
      );
    }

    if (!pendingAction) {
      return this.buildResult(
        `No pending action found for approval "${approvalId}". It may have expired.`,
        false,
        startMs,
      );
    }

    // Extract connector routing from the action context
    const actionCtx = pendingAction.actionContext as Record<string, unknown> | undefined;
    const connectorId = actionCtx?.connectorId as string | undefined;
    const operation = actionCtx?.operation as string | undefined;
    const params = actionCtx?.params as Record<string, unknown> | undefined;

    if (!connectorId || !operation) {
      try {
        pendingActionStore?.markFailed(approvalId, "Missing connector routing info");
      } catch {
        // non-critical
      }
      return this.buildResult(
        `Cannot execute action "${pendingAction.actionType}": missing connector routing info`,
        false,
        startMs,
      );
    }

    // Look up the connector
    const connector = registry.get(connectorId);

    if (!connector) {
      try {
        pendingActionStore?.markFailed(approvalId, `Connector "${connectorId}" not found`);
      } catch {
        // non-critical
      }
      return this.buildResult(
        `Connector "${connectorId}" not found in registry`,
        false,
        startMs,
      );
    }

    // Build the ConnectorAction with an approved policy decision
    const connectorAction: ConnectorAction = {
      operation,
      params: params ?? {},
      policyDecision: {
        action: pendingAction.actionType,
        riskClass: "C",
        verdict: "approved",
        reason: `User approved action (approvalId: ${approvalId})`,
      },
      traceId: context.traceId,
    };

    this.log("Executing action via connector", {
      connectorId,
      operation,
      approvalId,
    });

    try {
      const result = await connector.execute(connectorAction);

      if (!result.success) {
        this.log("Connector execution failed", {
          approvalId,
          error: result.error,
        });

        try {
          pendingActionStore?.markFailed(approvalId, result.error ?? "Connector execution failed");
        } catch {
          // non-critical
        }

        const errorSurface = SurfaceFactory.generic(
          "Action Failed",
          {
            message: result.error ?? "The action could not be completed.",
            approvalId,
            status: "error",
            operation,
            connectorId,
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

      try {
        pendingActionStore?.markExecuted(approvalId);
      } catch {
        // non-critical
      }

      // Track the approval decision
      this.trackDecision(context, pendingAction, true);

      const successSurface = SurfaceFactory.generic(
        "Action Executed",
        {
          message: this.describeSuccess(operation, result.result),
          approvalId,
          status: "executed",
          operation,
          connectorId,
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

      try {
        pendingActionStore?.markFailed(approvalId, errorMsg);
      } catch {
        // non-critical
      }

      const errorSurface = SurfaceFactory.generic(
        "Action Failed",
        {
          message: `An unexpected error occurred: ${errorMsg}`,
          approvalId,
          status: "error",
          operation,
          connectorId,
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
   * Track an approval or rejection decision via the ApprovalTracker (if available).
   */
  private trackDecision(
    context: AgentContext,
    pendingAction: { actionType: string; actionContext?: unknown } | undefined,
    approved: boolean,
  ): void {
    const approvalTracker = context.config?.["approvalTracker"] as
      | ApprovalTracker
      | undefined;
    if (!approvalTracker || !pendingAction) return;

    try {
      const actionCtx = pendingAction.actionContext as Record<string, unknown> | undefined;
      const domain = (actionCtx?.domain as string) ?? this.inferDomain(pendingAction.actionType);
      approvalTracker.recordDecision({
        actionType: pendingAction.actionType,
        domain,
        approved,
        timestamp: Date.now(),
        context: actionCtx,
      });
    } catch {
      // Tracking failure is non-critical
    }
  }

  /**
   * Infer a domain from the action type when no explicit domain is available.
   * e.g., "email.send" -> "email", "slack.reply" -> "slack"
   */
  private inferDomain(actionType: string): string {
    const dotIndex = actionType.indexOf(".");
    return dotIndex > 0 ? actionType.slice(0, dotIndex) : actionType;
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
