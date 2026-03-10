import { createEvent } from "@waibspace/event-bus";
import type { WaibEvent } from "@waibspace/types";

/**
 * A polling task that periodically checks a connected data source.
 */
export interface PollingTask {
  connectorId: string;
  operation: string;
  intervalMs: number;
  lastRunMs: number;
  consecutiveFailures: number;
  enabled: boolean;
}

const TICK_INTERVAL_MS = 10_000; // check every 10 seconds
const MAX_BACKOFF_MS = 60 * 60 * 1000; // 1 hour cap

/**
 * TaskScheduler periodically polls connected data sources (email, calendar,
 * etc.) so Waib can monitor and act proactively.
 *
 * It runs a single setInterval loop every 10 seconds, checks which tasks are
 * due, and emits `system.poll` WaibEvents for each.
 *
 * Backoff strategy: after 3 consecutive failures the interval doubles; after 5
 * it quadruples. The effective interval is capped at 1 hour.
 */
export class TaskScheduler {
  private tasks = new Map<string, PollingTask>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private emitEvent: (event: WaibEvent) => void;

  constructor(emitEvent: (event: WaibEvent) => void) {
    this.emitEvent = emitEvent;
  }

  /** Register a polling task. The task key is `connectorId:operation`. */
  register(connectorId: string, operation: string, intervalMs: number): void {
    const taskId = `${connectorId}:${operation}`;
    this.tasks.set(taskId, {
      connectorId,
      operation,
      intervalMs,
      lastRunMs: 0,
      consecutiveFailures: 0,
      enabled: true,
    });
  }

  /** Start the scheduler tick loop. */
  start(): void {
    if (this.timer) return; // already running
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  /** Stop the scheduler. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Get status of all registered tasks. */
  status(): PollingTask[] {
    return Array.from(this.tasks.values());
  }

  /** Enable or disable a specific task by its id (`connectorId:operation`). */
  setEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = enabled;
    }
  }

  /** Record a successful poll so the failure count resets. */
  recordSuccess(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.consecutiveFailures = 0;
    }
  }

  /** Record a poll failure so the backoff kicks in. */
  recordFailure(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.consecutiveFailures += 1;
    }
  }

  // ---- private ----

  private tick(): void {
    const now = Date.now();
    for (const [taskId, task] of this.tasks) {
      if (!task.enabled) continue;

      const effectiveInterval = this.getEffectiveInterval(task);
      if (now - task.lastRunMs >= effectiveInterval) {
        task.lastRunMs = now;
        this.emitPollEvent(task);
      }
    }
  }

  /**
   * Compute the effective polling interval taking exponential backoff into
   * account.
   *
   * - 0-2 failures: base interval
   * - 3-4 failures: 2x base interval
   * - 5+ failures: 4x base interval
   * - Capped at MAX_BACKOFF_MS (1 hour)
   */
  private getEffectiveInterval(task: PollingTask): number {
    let multiplier = 1;
    if (task.consecutiveFailures >= 5) {
      multiplier = 4;
    } else if (task.consecutiveFailures >= 3) {
      multiplier = 2;
    }
    return Math.min(task.intervalMs * multiplier, MAX_BACKOFF_MS);
  }

  private emitPollEvent(task: PollingTask): void {
    const event = createEvent(
      "system.poll",
      {
        connectorId: task.connectorId,
        operation: task.operation,
        source: "scheduler",
      },
      "scheduler",
    );
    event.metadata = { userId: "default" };
    this.emitEvent(event);
  }
}
