import type { TrustLevel } from "@waibspace/types";

export interface MCPCacheConfig {
  /** Enable response caching (default: false). */
  enabled?: boolean;
  /** Default TTL in milliseconds (default: 5 minutes). */
  defaultTtlMs?: number;
  /** Per-tool TTL overrides keyed by tool name, in milliseconds. */
  toolTtlMs?: Record<string, number>;
  /** Maximum cached entries (default: 500). */
  maxEntries?: number;
  /** Return stale data while refreshing in the background (default: false). */
  staleWhileRevalidate?: boolean;
  /**
   * Tool name prefixes that are considered mutating (write) operations.
   * Invoking a mutating tool automatically invalidates all cached entries
   * for this connector. Defaults to common write prefixes.
   */
  mutatingPrefixes?: string[];
}

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse";
  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For SSE/HTTP transport
  url?: string;
  // Trust and metadata
  trustLevel?: TrustLevel;
  enabled?: boolean;
  /** Optional caching configuration for tool responses. */
  cache?: MCPCacheConfig;
}

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  serverId: string;
  serverName: string;
}

/** A single health-check result stored in the history ring buffer. */
export interface HealthCheckEntry {
  timestamp: number;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/** Aggregated health metrics for a single MCP server. */
export interface ConnectorHealthMetrics {
  serverId: string;
  serverName: string;
  transport: string;
  connected: boolean;
  /** ISO-8601 timestamp of the last successful health check. */
  lastChecked: string | null;
  /** ISO-8601 timestamp of when the server first connected in this session. */
  connectedSince: string | null;
  /** Uptime percentage (0-100) based on recent health checks. */
  uptimePercent: number;
  /** Most recent ping latency in ms. */
  latencyMs: number | null;
  /** Average latency over recent checks. */
  avgLatencyMs: number | null;
  /** Total error count since tracking started. */
  errorCount: number;
  /** Recent error history (most recent first). */
  recentErrors: Array<{ timestamp: string; message: string }>;
  /** Recent health check history (most recent first). */
  checkHistory: HealthCheckEntry[];
}
