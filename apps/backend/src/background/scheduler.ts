import { EventBus, createEvent } from "@waibspace/event-bus";
import type { Orchestrator } from "@waibspace/orchestrator";
import type { MemoryStore } from "@waibspace/memory";
import type { BackgroundTask, TaskExecution } from "./types";

const MAX_HISTORY = 50;

export class BackgroundTaskScheduler {
  private tasks = new Map<string, BackgroundTask>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private history = new Map<string, TaskExecution[]>();
  private running = new Set<string>();

  constructor(
    private eventBus: EventBus,
    private orchestrator: Orchestrator,
    private memoryStore: MemoryStore,
  ) {}

  register(task: BackgroundTask): void {
    this.tasks.set(task.id, task);
    this.history.set(task.id, []);
  }

  unregister(taskId: string): void {
    this.disable(taskId);
    this.tasks.delete(taskId);
    this.history.delete(taskId);
  }

  enable(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
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
  }

  start(): void {
    for (const task of this.tasks.values()) {
      if (task.enabled) this.scheduleTask(task);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }

  private scheduleTask(task: BackgroundTask): void {
    // Clear any existing timer for this task
    const existing = this.timers.get(task.id);
    if (existing) clearInterval(existing);

    const timer = setInterval(() => this.executeTask(task.id), task.intervalMs);
    this.timers.set(task.id, timer);
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled || this.running.has(taskId)) return;

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
        },
        "background-scheduler",
      );

      await this.orchestrator.processEvent(event);

      const execution: TaskExecution = {
        taskId,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        success: true,
      };
      task.lastRun = startTime;
      this.history.get(taskId)?.push(execution);
    } catch (error) {
      const execution: TaskExecution = {
        taskId,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        success: false,
        error: String(error),
      };
      task.lastError = String(error);
      this.history.get(taskId)?.push(execution);
    } finally {
      this.running.delete(taskId);
    }

    // Keep only last N executions per task
    const hist = this.history.get(taskId);
    if (hist && hist.length > MAX_HISTORY) {
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
