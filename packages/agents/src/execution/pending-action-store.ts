/**
 * In-memory store for pending actions awaiting user approval.
 *
 * When a PolicyGateAgent decision requires approval, the ApprovalSurfaceAgent
 * stores the action details here keyed by approvalId. When the user approves,
 * the ActionExecutorAgent retrieves and executes the action via the connector.
 *
 * Entries expire after a configurable TTL (default 30 minutes) to avoid
 * unbounded memory growth.
 */

export interface PendingAction {
  approvalId: string;
  connectorId: string;
  operation: string;
  params: Record<string, unknown>;
  actionType: string;
  createdAt: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

class PendingActionStoreImpl {
  private store = new Map<string, PendingAction>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  set(action: PendingAction): void {
    this.evictExpired();
    this.store.set(action.approvalId, action);
  }

  get(approvalId: string): PendingAction | undefined {
    this.evictExpired();
    return this.store.get(approvalId);
  }

  remove(approvalId: string): boolean {
    return this.store.delete(approvalId);
  }

  /** Remove all expired entries. */
  private evictExpired(): void {
    const now = Date.now();
    for (const [id, action] of this.store) {
      if (now - action.createdAt > this.ttlMs) {
        this.store.delete(id);
      }
    }
  }
}

/**
 * Singleton pending-action store shared between ApprovalSurfaceAgent
 * and ActionExecutorAgent.
 */
export const pendingActionStore = new PendingActionStoreImpl();
