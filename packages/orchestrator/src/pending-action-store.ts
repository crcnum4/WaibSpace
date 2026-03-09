import type {
  PendingAction,
  PendingActionStatus,
  IPendingActionStore,
} from "@waibspace/types";

/**
 * In-memory implementation of IPendingActionStore.
 *
 * Tracks action lifecycle: pending -> approved/denied -> executed/failed.
 * Suitable for single-process deployments; swap for a DB-backed
 * implementation when persistence is needed.
 */
export class InMemoryPendingActionStore implements IPendingActionStore {
  private actions = new Map<string, PendingAction>();

  add(action: PendingAction): void {
    if (this.actions.has(action.approvalId)) {
      throw new Error(
        `Pending action with approvalId "${action.approvalId}" already exists`,
      );
    }
    this.actions.set(action.approvalId, { ...action });
  }

  get(approvalId: string): PendingAction | undefined {
    const action = this.actions.get(approvalId);
    return action ? { ...action } : undefined;
  }

  list(status?: PendingActionStatus): PendingAction[] {
    const all = Array.from(this.actions.values());
    const filtered = status ? all.filter((a) => a.status === status) : all;
    // Newest first
    return filtered.sort((a, b) => b.createdAt - a.createdAt).map((a) => ({ ...a }));
  }

  approve(approvalId: string): PendingAction {
    return this.transition(approvalId, "pending", "approved");
  }

  deny(approvalId: string, reason?: string): PendingAction {
    return this.transition(approvalId, "pending", "denied", reason);
  }

  markExecuted(approvalId: string): PendingAction {
    return this.transition(approvalId, "approved", "executed");
  }

  markFailed(approvalId: string, reason: string): PendingAction {
    return this.transition(approvalId, "approved", "failed", reason);
  }

  prune(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;
    for (const [id, action] of this.actions) {
      if (action.updatedAt < cutoff) {
        this.actions.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  // -- Internal helpers -----------------------------------------------------

  private transition(
    approvalId: string,
    expectedStatus: PendingActionStatus,
    newStatus: PendingActionStatus,
    reason?: string,
  ): PendingAction {
    const action = this.actions.get(approvalId);
    if (!action) {
      throw new Error(`Pending action "${approvalId}" not found`);
    }
    if (action.status !== expectedStatus) {
      throw new Error(
        `Cannot transition "${approvalId}" from "${action.status}" to "${newStatus}" (expected "${expectedStatus}")`,
      );
    }
    action.status = newStatus;
    action.updatedAt = Date.now();
    if (reason) {
      action.statusReason = reason;
    }
    return { ...action };
  }
}
