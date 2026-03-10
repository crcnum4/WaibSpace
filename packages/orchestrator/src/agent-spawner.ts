import type { WaibEvent, AgentOutput } from "@waibspace/types";
import { EventBus, createEvent } from "@waibspace/event-bus";

export interface SpawnRequest {
  parentTraceId: string;
  agentType: "coding" | "research" | "analysis" | "custom";
  task: string;                    // Human-readable task description
  payload: Record<string, unknown>; // Task-specific data
  priority?: number;               // 0-100, default 50
  timeoutMs?: number;              // Default 60000
}

export interface SpawnResult {
  requestId: string;
  parentTraceId: string;
  agentType: string;
  status: "completed" | "failed" | "timeout";
  output?: AgentOutput;
  error?: string;
  durationMs: number;
}

export class AgentSpawner {
  private activeSpawns = new Map<string, { request: SpawnRequest; startMs: number }>();
  private readonly maxConcurrent: number;

  constructor(
    private bus: EventBus,
    options?: { maxConcurrent?: number },
  ) {
    this.maxConcurrent = options?.maxConcurrent ?? 5;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen for spawn requests
    this.bus.on("agent.spawn.request", (event: WaibEvent) => {
      const request = event.payload as SpawnRequest;
      this.handleSpawnRequest(request, event.traceId);
    });
  }

  /**
   * Request spawning a new agent task.
   * Returns a requestId that can be used to track the result.
   */
  spawn(request: SpawnRequest): string {
    const requestId = `spawn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (this.activeSpawns.size >= this.maxConcurrent) {
      // Emit failure — at capacity
      const result: SpawnResult = {
        requestId,
        parentTraceId: request.parentTraceId,
        agentType: request.agentType,
        status: "failed",
        error: `Max concurrent spawns reached (${this.maxConcurrent})`,
        durationMs: 0,
      };
      this.emitComplete(result, request.parentTraceId);
      return requestId;
    }

    this.activeSpawns.set(requestId, { request, startMs: Date.now() });

    // Set timeout
    const timeout = request.timeoutMs ?? 60_000;
    setTimeout(() => {
      if (this.activeSpawns.has(requestId)) {
        this.activeSpawns.delete(requestId);
        const result: SpawnResult = {
          requestId,
          parentTraceId: request.parentTraceId,
          agentType: request.agentType,
          status: "timeout",
          error: `Timed out after ${timeout}ms`,
          durationMs: timeout,
        };
        this.emitComplete(result, request.parentTraceId);
      }
    }, timeout);

    return requestId;
  }

  /**
   * Complete a spawned task (called by the task executor).
   */
  complete(requestId: string, output?: AgentOutput, error?: string): void {
    const entry = this.activeSpawns.get(requestId);
    if (!entry) return;

    this.activeSpawns.delete(requestId);
    const result: SpawnResult = {
      requestId,
      parentTraceId: entry.request.parentTraceId,
      agentType: entry.request.agentType,
      status: error ? "failed" : "completed",
      output,
      error,
      durationMs: Date.now() - entry.startMs,
    };
    this.emitComplete(result, entry.request.parentTraceId);
  }

  private handleSpawnRequest(request: SpawnRequest, traceId: string): void {
    this.spawn({ ...request, parentTraceId: traceId });
  }

  private emitComplete(result: SpawnResult, traceId: string): void {
    const event = createEvent(
      "agent.spawn.complete",
      result,
      "agent-spawner",
      traceId,
    );
    this.bus.emit(event);
  }

  /** Get count of active spawns. */
  get activeCount(): number {
    return this.activeSpawns.size;
  }

  /** Stop all active spawns. */
  shutdown(): void {
    this.activeSpawns.clear();
  }
}
