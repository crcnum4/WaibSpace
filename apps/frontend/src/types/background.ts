export interface BackgroundTask {
  id: string;
  name: string;
  description: string;
  intervalMs: number;
  enabled: boolean;
  allowedConnectors: string[];
  actionClass: string;
  outputTarget: string;
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
