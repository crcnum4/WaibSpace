import type { TrustLevel } from "@waibspace/types";

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
}

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  serverId: string;
  serverName: string;
}
