import type { RiskClass } from "@waibspace/types";

export interface BackgroundTask {
  id: string;
  name: string;
  description: string;
  intervalMs: number;
  enabled: boolean;
  allowedConnectors: string[];
  actionClass: RiskClass;
  outputTarget: string; // "surface" | "memory" | "notification"
  lastRun?: number;
  lastResult?: unknown;
  lastError?: string;
}

export interface TaskExecution {
  taskId: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  result?: unknown;
  error?: string;
}
