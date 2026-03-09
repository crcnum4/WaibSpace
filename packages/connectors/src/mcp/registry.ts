import { MCPConnector } from "./mcp-connector";
import type { MCPServerConfig, MCPToolInfo, HealthCheckEntry, ConnectorHealthMetrics } from "./types";
import type { PolicyEngine } from "@waibspace/policy";
import type { WaibDatabase, MCPServerRow } from "@waibspace/db";
import type { TrustLevel } from "@waibspace/types";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, renameSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

/** Maximum number of health check entries to retain per server. */
const MAX_HEALTH_HISTORY = 50;

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
  private connectionErrors = new Map<string, string>();
  private policyEngine: PolicyEngine | undefined;
  private db?: WaibDatabase;

  /** Health-check history per server (ring buffer, newest first). */
  private healthHistory = new Map<string, HealthCheckEntry[]>();
  /** Timestamp when each server was connected in this session. */
  private connectedSince = new Map<string, number>();
  /** Total error count per server since tracking started. */
  private errorCounts = new Map<string, number>();
  /** Recent error messages per server (newest first, capped). */
  private recentErrors = new Map<string, Array<{ timestamp: number; message: string }>>();
  /** Handle for the periodic health-check interval. */
  private healthInterval: ReturnType<typeof setInterval> | null = null;

  constructor(policyEngine?: PolicyEngine, db?: WaibDatabase) {
    this.policyEngine = policyEngine;
    this.db = db;
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
    this.connectionErrors.delete(id);
    this.servers.delete(id);
  }

  /** Connect to a specific server and auto-generate policy rules for discovered tools. */
  async connectServer(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`MCP server "${id}" not found`);
    }
    try {
      await entry.connector.connect();
      // Clear any previous connection error on success
      this.connectionErrors.delete(id);
      this.connectedSince.set(id, Date.now());
      this.generatePolicyRules(id, entry.connector.getDiscoveredTools());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.connectionErrors.set(id, message);
      this.recordError(id, message);
      throw error;
    }
  }

  /** Disconnect from a specific server and remove its policy rules. */
  async disconnectServer(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`MCP server "${id}" not found`);
    }
    this.removePolicyRules(id);
    this.connectionErrors.delete(id);
    this.connectedSince.delete(id);
    await entry.connector.disconnect();
  }

  /** Get status of all servers. */
  getServers(): Array<{ config: MCPServerConfig; connected: boolean; toolCount: number; error: string | null }> {
    return Array.from(this.servers.values()).map(({ config, connector }) => ({
      config,
      connected: connector.isConnected(),
      toolCount: connector.getDiscoveredTools().length,
      error: this.connectionErrors.get(config.id) ?? null,
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

  /** Ping a connected server and return latency info. */
  async testServer(id: string): Promise<{ ok: true; latencyMs: number; toolCount: number } | { ok: false; error: string }> {
    const entry = this.servers.get(id);
    if (!entry) {
      return { ok: false, error: `MCP server "${id}" not found` };
    }
    if (!entry.connector.isConnected()) {
      return { ok: false, error: "Server is not connected" };
    }
    return entry.connector.ping();
  }

  /** Get a connected MCPConnector by server ID. */
  getConnector(id: string): MCPConnector | undefined {
    return this.servers.get(id)?.connector;
  }

  // ---- Health monitoring ----

  /** Record a health check result for a server. */
  private recordHealthCheck(serverId: string, entry: HealthCheckEntry): void {
    let history = this.healthHistory.get(serverId);
    if (!history) {
      history = [];
      this.healthHistory.set(serverId, history);
    }
    history.unshift(entry);
    if (history.length > MAX_HEALTH_HISTORY) {
      history.length = MAX_HEALTH_HISTORY;
    }
    if (!entry.ok && entry.error) {
      this.recordError(serverId, entry.error);
    }
  }

  /** Record an error for a server. */
  private recordError(serverId: string, message: string): void {
    this.errorCounts.set(serverId, (this.errorCounts.get(serverId) ?? 0) + 1);
    let errors = this.recentErrors.get(serverId);
    if (!errors) {
      errors = [];
      this.recentErrors.set(serverId, errors);
    }
    errors.unshift({ timestamp: Date.now(), message });
    if (errors.length > 20) {
      errors.length = 20;
    }
  }

  /** Run a health check (ping) on all connected servers and record results. */
  async runHealthChecks(): Promise<void> {
    const entries = Array.from(this.servers.entries());
    await Promise.allSettled(
      entries.map(async ([id, { connector }]) => {
        if (!connector.isConnected()) {
          this.recordHealthCheck(id, { timestamp: Date.now(), ok: false, error: "Not connected" });
          return;
        }
        const result = await connector.ping();
        if (result.ok) {
          this.recordHealthCheck(id, { timestamp: Date.now(), ok: true, latencyMs: result.latencyMs });
        } else {
          this.recordHealthCheck(id, { timestamp: Date.now(), ok: false, error: result.error });
        }
      }),
    );
  }

  /** Start periodic health checks at the given interval (default 30s). */
  startHealthChecks(intervalMs = 30_000): void {
    this.stopHealthChecks();
    this.healthInterval = setInterval(() => {
      this.runHealthChecks().catch(() => {});
    }, intervalMs);
    // Run an initial check immediately
    this.runHealthChecks().catch(() => {});
  }

  /** Stop periodic health checks. */
  stopHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  /** Get aggregated health metrics for all servers. */
  getHealthMetrics(): ConnectorHealthMetrics[] {
    return Array.from(this.servers.values()).map(({ config, connector }) => {
      const id = config.id;
      const history = this.healthHistory.get(id) ?? [];
      const okChecks = history.filter((h) => h.ok);
      const uptimePercent = history.length > 0 ? Math.round((okChecks.length / history.length) * 100) : 0;

      const latencies = okChecks.filter((h) => h.latencyMs != null).map((h) => h.latencyMs!);
      const latencyMs = latencies.length > 0 ? latencies[0] : null;
      const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

      const lastOk = okChecks[0];
      const connSince = this.connectedSince.get(id);
      const errors = this.recentErrors.get(id) ?? [];

      return {
        serverId: id,
        serverName: config.name,
        transport: config.transport,
        connected: connector.isConnected(),
        lastChecked: lastOk ? new Date(lastOk.timestamp).toISOString() : null,
        connectedSince: connSince ? new Date(connSince).toISOString() : null,
        uptimePercent,
        latencyMs,
        avgLatencyMs,
        errorCount: this.errorCounts.get(id) ?? 0,
        recentErrors: errors.map((e) => ({
          timestamp: new Date(e.timestamp).toISOString(),
          message: e.message,
        })),
        checkHistory: history.slice(0, 20),
      };
    });
  }

  private configToRow(config: MCPServerConfig): MCPServerRow {
    return {
      id: config.id,
      name: config.name,
      transport: config.transport,
      command: config.command ?? null,
      args: config.args ? JSON.stringify(config.args) : null,
      env: config.env ? JSON.stringify(config.env) : null,
      url: config.url ?? null,
      trust_level: config.trustLevel ?? "semi-trusted",
      enabled: config.enabled !== false ? 1 : 0,
      created_at: Date.now(),
    };
  }

  private rowToConfig(row: MCPServerRow): MCPServerConfig {
    return {
      id: row.id,
      name: row.name,
      transport: row.transport as "stdio" | "sse",
      command: row.command ?? undefined,
      args: row.args ? JSON.parse(row.args) : undefined,
      env: row.env ? JSON.parse(row.env) : undefined,
      url: row.url ?? undefined,
      trustLevel: (row.trust_level as TrustLevel) ?? "semi-trusted",
      enabled: row.enabled === 1,
    };
  }

  /** Persist server configs. When db is provided, saves to SQLite. Otherwise saves to JSON file. */
  async save(path?: string): Promise<void> {
    if (this.db) {
      for (const { config } of this.servers.values()) {
        this.db.saveMCPServer(this.configToRow(config));
      }
      return;
    }

    if (!path) return;
    const configs = Array.from(this.servers.values()).map(({ config }) => config);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(configs, null, 2), "utf-8");
  }

  /** Load server configs. When db is provided, loads from SQLite. Otherwise loads from JSON file. */
  async load(path?: string): Promise<void> {
    if (this.db) {
      // Migrate legacy JSON if it exists
      this.migrateJsonIfNeeded();

      const rows = this.db.getMCPServers();
      for (const row of rows) {
        const config = this.rowToConfig(row);
        if (!this.servers.has(config.id)) {
          this.addServer(config);
        }
      }
      return;
    }

    if (!path) return;
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

  /** Migrate legacy JSON file to SQLite if it exists. */
  private migrateJsonIfNeeded(): void {
    if (!this.db) return;
    const jsonPath = "./data/mcp-servers.json";
    if (existsSync(jsonPath)) {
      try {
        const configs: MCPServerConfig[] = JSON.parse(readFileSync(jsonPath, "utf-8"));
        for (const config of configs) {
          this.db.saveMCPServer(this.configToRow(config));
        }
        renameSync(jsonPath, jsonPath + ".migrated");
        console.log(`[mcp-registry] Migrated ${configs.length} servers from JSON to SQLite`);
      } catch {
        // ignore migration errors
      }
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
