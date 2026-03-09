import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { BaseConnector } from "../base-connector";
import type {
  ConnectorRequest,
  ConnectorResponse,
  ConnectorAction,
  ConnectorResult,
} from "../types";
import type { MCPServerConfig, MCPToolInfo } from "./types";
import {
  KNOWN_SCHEMAS,
  extractPayload,
  validateResponse,
} from "./validation";

export class MCPConnector extends BaseConnector {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private discoveredTools: MCPToolInfo[] = [];
  private readonly serverConfig: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    super({
      id: config.id,
      name: config.name,
      type: "mcp",
      trustLevel: config.trustLevel ?? "semi-trusted",
      capabilities: {
        connectorId: config.id,
        connectorType: "mcp",
        actions: [], // dynamically discovered on connect
        dataTypes: ["mcp-tool-result"],
        trustLevel: config.trustLevel ?? "semi-trusted",
      },
    });
    this.serverConfig = config;
  }

  async connect(): Promise<void> {
    try {
      this.transport = this.createTransport();

      this.client = new Client(
        { name: "waibspace", version: "0.0.1" },
        { capabilities: {} },
      );

      await this.client.connect(this.transport);
      this.connected = true;
      this.log("Connected to MCP server");

      // Discover tools
      await this.discoverTools();
    } catch (error) {
      this.connected = false;
      this.client = null;
      this.transport = null;
      const message =
        error instanceof Error ? error.message : String(error);
      this.log(`Failed to connect: ${message}`);
      throw new Error(
        `Failed to connect to MCP server "${this.serverConfig.name}": ${message}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.log(`Error during disconnect: ${message}`);
    } finally {
      this.client = null;
      this.transport = null;
      this.connected = false;
      this.discoveredTools = [];
    }
  }

  getDiscoveredTools(): MCPToolInfo[] {
    return [...this.discoveredTools];
  }

  /** Ping the server by listing tools and return latency in ms. */
  async ping(): Promise<{ ok: true; latencyMs: number; toolCount: number } | { ok: false; error: string }> {
    if (!this.client || !this.connected) {
      return { ok: false, error: "Server is not connected" };
    }
    const start = performance.now();
    try {
      const response = await this.client.listTools();
      const latencyMs = Math.round(performance.now() - start);
      return { ok: true, latencyMs, toolCount: response.tools.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  }

  protected async doFetch(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse> {
    const result = await this.invokeTool(
      request.operation,
      request.params,
    );
    return {
      data: result,
      provenance: this.createProvenance(
        `${this.serverConfig.id}:${request.operation}`,
      ),
    };
  }

  protected async doExecute(
    action: ConnectorAction,
  ): Promise<ConnectorResult> {
    try {
      const result = await this.invokeTool(
        action.operation,
        action.params,
      );
      return { success: true, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private createTransport(): StdioClientTransport | SSEClientTransport {
    if (this.serverConfig.transport === "stdio") {
      if (!this.serverConfig.command) {
        throw new Error(
          "stdio transport requires a command in MCPServerConfig",
        );
      }
      return new StdioClientTransport({
        command: this.serverConfig.command,
        args: this.serverConfig.args,
        env: {
          ...process.env,
          ...(this.serverConfig.env ?? {}),
        } as Record<string, string>,
      });
    }

    if (this.serverConfig.transport === "sse") {
      if (!this.serverConfig.url) {
        throw new Error(
          "SSE transport requires a url in MCPServerConfig",
        );
      }
      return new SSEClientTransport(new URL(this.serverConfig.url));
    }

    throw new Error(
      `Unsupported transport: ${this.serverConfig.transport}`,
    );
  }

  private async discoverTools(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const response = await this.client.listTools();
      this.discoveredTools = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
        serverId: this.serverConfig.id,
        serverName: this.serverConfig.name,
      }));

      // Update capabilities with discovered tool names
      (this.capabilities as { actions: string[] }).actions =
        this.discoveredTools.map((t) => t.name);

      this.log(
        `Discovered ${this.discoveredTools.length} tools: ${this.discoveredTools.map((t) => t.name).join(", ")}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.log(`Failed to discover tools: ${message}`);
      // Connection is still valid, just no tools discovered
      this.discoveredTools = [];
    }
  }

  private async invokeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error("MCP client is not connected");
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      const content = result.content;

      // Validate response against known schema (if one exists)
      const schema = KNOWN_SCHEMAS[toolName];
      if (schema) {
        try {
          const payload = extractPayload(content);
          const validation = validateResponse(payload, schema);
          if (!validation.valid) {
            this.log(
              `Validation warnings for "${toolName}": ${validation.warnings.join("; ")}`,
            );
          }
        } catch (validationError) {
          // Never let validation itself crash the pipeline
          const msg =
            validationError instanceof Error
              ? validationError.message
              : String(validationError);
          this.log(`Validation error for "${toolName}": ${msg}`);
        }
      }

      return content;
    } catch (error) {
      // If the server process crashed, mark as disconnected
      this.connected = false;
      this.client = null;
      this.transport = null;

      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `MCP tool "${toolName}" invocation failed on server "${this.serverConfig.name}": ${message}`,
      );
    }
  }
}
