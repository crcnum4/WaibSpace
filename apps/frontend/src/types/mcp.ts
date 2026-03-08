export interface MCPServer {
  config: {
    id: string;
    name: string;
    transport: string;
    command?: string;
    args?: string[];
    url?: string;
  };
  connected: boolean;
  toolCount: number;
}

export interface MCPTool {
  name: string;
  description?: string;
  serverId: string;
}
