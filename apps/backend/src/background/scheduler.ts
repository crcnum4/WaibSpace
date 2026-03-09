import { EventBus, createEvent } from "@waibspace/event-bus";
import type { Orchestrator } from "@waibspace/orchestrator";
import type { MemoryStore } from "@waibspace/memory";
import type { BackgroundTask, TaskExecution } from "./types";

const MAX_HISTORY = 50;
const DEFAULT_RETRY_BACKOFF_MS = 5_000;

export class BackgroundTaskScheduler {
  private tasks = new Map<string, BackgroundTask>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private history = new Map<string, TaskExecution[]>();
  private running = new Set<string>();
  private stopped = false;

  constructor(
    private eventBus: EventBus,
    private orchestrator: Orchestrator,
    private memoryStore: MemoryStore,
  ) {}

  register(task: BackgroundTask): void {
    this.tasks.set(task.id, { ...task, consecutiveFailures: 0 });
    this.history.set(task.id, []);
  }

  unregister(taskId: string): void {
    this.disable(taskId);
    this.tasks.delete(taskId);
    this.history.delete(taskId);
  }

  enable(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || this.stopped) return;
    task.enabled = true;
    this.scheduleTask(task);
  }

  disable(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) task.enabled = false;

    const timer = this.timers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(taskId);
    }

    const retryTimer = this.retryTimers.get(taskId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(taskId);
    }
  }

  start(): void {
    this.stopped = false;
    for (const task of this.tasks.values()) {
      if (task.enabled) this.scheduleTask(task);
    }
    console.log("[scheduler] Background task scheduler started");
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    console.log("[scheduler] Background task scheduler stopped");
  }

  private scheduleTask(task: BackgroundTask): void {
    // Clear any existing timer for this task
    const existing = this.timers.get(task.id);
    if (existing) clearInterval(existing);

    const timer = setInterval(() => this.executeTask(task.id), task.intervalMs);
    this.timers.set(task.id, timer);
  }

  private async executeTask(taskId: string, attempt = 0): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled || this.running.has(taskId) || this.stopped) return;

    this.running.add(taskId);
    const startTime = Date.now();

    try {
      const event = createEvent(
        "background.task.triggered",
        {
          taskId: task.id,
          taskName: task.name,
          allowedConnectors: task.allowedConnectors,
          actionClass: task.actionClass,
          attempt,
        },
        "background-scheduler",
      );

      await this.orchestrator.processEvent(event);

      const execution: TaskExecution = {
        taskId,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        success: true,
        attempt,
      };
      task.lastRun = startTime;
      task.consecutiveFailures = 0;
      this.pushHistory(taskId, execution);

      console.log(
        `[scheduler] Task "${task.name}" completed successfully (${execution.durationMs}ms)`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const execution: TaskExecution = {
        taskId,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMsg,
        attempt,
      };
      task.lastError = errorMsg;
      task.consecutiveFailures = (task.consecutiveFailures ?? 0) + 1;
      this.pushHistory(taskId, execution);

      console.error(
        `[scheduler] Task "${task.name}" failed (attempt ${attempt + 1}): ${errorMsg}`,
      );

      // Schedule retry if within limits
      const maxRetries = task.maxRetries ?? 0;
      if (attempt < maxRetries && task.enabled && !this.stopped) {
        const backoffMs = (task.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS) * Math.pow(2, attempt);
        console.log(
          `[scheduler] Retrying task "${task.name}" in ${backoffMs}ms (attempt ${attempt + 2}/${maxRetries + 1})`,
        );
        const retryTimer = setTimeout(() => {
          this.retryTimers.delete(taskId);
          this.executeTask(taskId, attempt + 1);
        }, backoffMs);
        this.retryTimers.set(taskId, retryTimer);
      }
    } finally {
      this.running.delete(taskId);
    }
  }

  private pushHistory(taskId: string, execution: TaskExecution): void {
    const hist = this.history.get(taskId);
    if (!hist) return;
    hist.push(execution);
    if (hist.length > MAX_HISTORY) {
      this.history.set(taskId, hist.slice(-MAX_HISTORY));
    }
  }

  getStatus(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  getHistory(taskId: string): TaskExecution[] {
    return this.history.get(taskId) ?? [];
  }
}
