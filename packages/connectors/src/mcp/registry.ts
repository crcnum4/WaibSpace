import { MCPConnector } from "./mcp-connector";
import type { MCPServerConfig, MCPToolInfo } from "./types";
import type { PolicyEngine } from "@waibspace/policy";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Classify an MCP tool name into a risk class for policy rule generation.
 * - Read-only tools (list*, get*, search*, read*) → Class A (auto-approve)
 * - Mutating tools (create, update, delete, send, write) → Class C (approval required)
 * - Everything else → Class B (standing approval)
 */
function classifyTool(toolName: string): { riskClass: "A" | "B" | "C"; autoApprove: boolean } {
  const lower = toolName.toLowerCase();

  const readOnlyPrefixes = ["list", "get", "search", "read"];
  if (readOnlyPrefixes.some((p) => lower.startsWith(p))) {
    return { riskClass: "A", autoApprove: true };
  }

  const mutatingKeywords = ["create", "update", "delete", "send", "write"];
  if (mutatingKeywords.some((k) => lower.includes(k))) {
    return { riskClass: "C", autoApprove: false };
  }

  return { riskClass: "B", autoApprove: true };
}

export class MCPServerRegistry {
  private servers = new Map<string, { config: MCPServerConfig; connector: MCPConnector }>();
  private policyEngine: PolicyEngine | undefined;

  constructor(policyEngine?: PolicyEngine) {
    this.policyEngine = policyEngine;
  }

  /** Add a new server config (doesn't connect yet). */
  addServer(config: MCPServerConfig): void {
    if (this.servers.has(config.id)) {
      throw new Error(`MCP server "${config.id}" is already registered`);
    }
    const connector = new MCPConnector(config);
    this.servers.set(config.id, { config, connector });
  }

  /** Remove a server (disconnects if connected). */
  async removeServer(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`MCP server "${id}" not found`);
    }
    if (entry.connector.isConnected()) {
      await this.disconnectServer(id);
    }
    this.servers.delete(id);
  }

  /** Connect to a specific server and auto-generate policy rules for discovered tools. */
  async connectServer(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`MCP server "${id}" not found`);
    }
    await entry.connector.connect();
    this.generatePolicyRules(id, entry.connector.getDiscoveredTools());
  }

  /** Disconnect from a specific server and remove its policy rules. */
  async disconnectServer(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`MCP server "${id}" not found`);
    }
    this.removePolicyRules(id);
    await entry.connector.disconnect();
  }

  /** Get status of all servers. */
  getServers(): Array<{ config: MCPServerConfig; connected: boolean; toolCount: number }> {
    return Array.from(this.servers.values()).map(({ config, connector }) => ({
      config,
      connected: connector.isConnected(),
      toolCount: connector.getDiscoveredTools().length,
    }));
  }

  /** Get a specific server's discovered tools. */
  getServerTools(id: string): MCPToolInfo[] {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`MCP server "${id}" not found`);
    }
    return entry.connector.getDiscoveredTools();
  }

  /** Get ALL tools across ALL connected servers. */
  getAllTools(): MCPToolInfo[] {
    const tools: MCPToolInfo[] = [];
    for (const { connector } of this.servers.values()) {
      if (connector.isConnected()) {
        tools.push(...connector.getDiscoveredTools());
      }
    }
    return tools;
  }

  /** Get a connected MCPConnector by server ID. */
  getConnector(id: string): MCPConnector | undefined {
    return this.servers.get(id)?.connector;
  }

  /** Persist server configs to a JSON file. */
  async save(path: string): Promise<void> {
    const configs = Array.from(this.servers.values()).map(({ config }) => config);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(configs, null, 2), "utf-8");
  }

  /** Load server configs from a JSON file (adds servers but does not connect). */
  async load(path: string): Promise<void> {
    try {
      const raw = await readFile(path, "utf-8");
      const configs: MCPServerConfig[] = JSON.parse(raw);
      for (const config of configs) {
        if (!this.servers.has(config.id)) {
          this.addServer(config);
        }
      }
    } catch {
      // File doesn't exist or is invalid — that's fine, start empty
    }
  }

  /** Generate policy rules for a server's discovered tools. */
  private generatePolicyRules(serverId: string, tools: MCPToolInfo[]): void {
    if (!this.policyEngine) return;

    for (const tool of tools) {
      const { riskClass, autoApprove } = classifyTool(tool.name);
      const ruleId = `mcp:${serverId}:${tool.name}`;
      this.policyEngine.addRule({
        id: ruleId,
        name: `MCP ${tool.serverName} - ${tool.name}`,
        description: tool.description ?? `Auto-generated rule for MCP tool "${tool.name}"`,
        actionPattern: tool.name,
        riskClass,
        autoApprove,
      });
    }
  }

  /** Remove all policy rules associated with a server. */
  private removePolicyRules(serverId: string): void {
    if (!this.policyEngine) return;

    const prefix = `mcp:${serverId}:`;
    for (const rule of this.policyEngine.getRules()) {
      if (rule.id.startsWith(prefix)) {
        this.policyEngine.removeRule(rule.id);
      }
    }
  }
}
