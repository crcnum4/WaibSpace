import { BaseConnector } from "../base-connector";
import type {
  ConnectorRequest,
  ConnectorResponse,
  ConnectorAction,
  ConnectorResult,
} from "../types";

export class MCPConnector extends BaseConnector {
  constructor(config: { serverCommand: string; serverArgs?: string[] }) {
    super({
      id: "mcp",
      name: "MCP Server",
      type: "mcp",
      trustLevel: "semi-trusted",
      capabilities: {
        connectorId: "mcp",
        connectorType: "mcp",
        actions: [], // dynamically discovered
        dataTypes: ["mcp-tool-result"],
        trustLevel: "semi-trusted",
      },
    });
  }

  async connect(): Promise<void> {
    // For MVP: just log that MCP connector is ready
    // Full implementation would spawn the MCP server process via stdio
    this.connected = true;
    this.log("MCP connector scaffold initialized (stub mode)");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  protected async doFetch(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse> {
    // Stub: return a placeholder response indicating MCP is not fully implemented
    return {
      data: {
        message:
          "MCP connector is in scaffold mode. Tool invocation not yet implemented.",
        operation: request.operation,
      },
      provenance: this.createProvenance("mcp-stub"),
    };
  }

  protected async doExecute(
    action: ConnectorAction,
  ): Promise<ConnectorResult> {
    return {
      success: false,
      error:
        "MCP connector is in scaffold mode. Execution not yet implemented.",
    };
  }
}
