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
