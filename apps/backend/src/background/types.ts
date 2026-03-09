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
  /** Maximum retry attempts on failure (default: 0 = no retries) */
  maxRetries?: number;
  /** Base delay in ms between retries, doubles each attempt (default: 5000) */
  retryBackoffMs?: number;
  lastRun?: number;
  lastResult?: unknown;
  lastError?: string;
  /** Number of consecutive failures (resets on success) */
  consecutiveFailures?: number;
}

export interface TaskExecution {
  taskId: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  result?: unknown;
  error?: string;
  /** Which retry attempt this was (0 = first attempt) */
  attempt?: number;
}
