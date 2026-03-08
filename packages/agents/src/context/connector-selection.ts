import type { AgentOutput } from "@waibspace/types";
import type { ConnectorRegistry } from "@waibspace/connectors";
import type { MCPToolInfo } from "@waibspace/connectors";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataSourcePlan } from "./context-planner";

export interface FinalizedPlan {
  retrievals: Array<{
    connectorId: string;
    operation: string;
    params: Record<string, unknown>;
    available: boolean;
    trustLevel: string;
  }>;
  unavailableConnectors: string[];
}

export class ConnectorSelectionAgent extends BaseAgent {
  constructor() {
    super({
      id: "context.connector-selection",
      name: "ConnectorSelectionAgent",
      type: "connector-selector",
      category: "context",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const dataSourcePlan = this.findDataSourcePlan(input);
    if (!dataSourcePlan || dataSourcePlan.dataSources.length === 0) {
      return this.createOutput(
        { retrievals: [], unavailableConnectors: [] },
        0,
        { dataState: "raw", timestamp: startMs },
      );
    }

    const registry = context.config?.["connectorRegistry"] as
      | ConnectorRegistry
      | undefined;
    if (!registry) {
      throw new Error(
        "ConnectorSelectionAgent requires connectorRegistry in context.config",
      );
    }

    this.log("Validating retrieval plan", {
      plannedSources: dataSourcePlan.dataSources.length,
    });

    const unavailableConnectors: string[] = [];
    const retrievals: FinalizedPlan["retrievals"] = [];

    for (const source of dataSourcePlan.dataSources) {
      const connector = registry.get(source.connectorId);
      let available = connector !== undefined && connector.isConnected();
      const trustLevel = connector?.trustLevel ?? "untrusted";

      // For MCP connectors, verify the requested tool is actually discovered
      if (available && connector?.type === "mcp") {
        const mcpConn = connector as unknown as {
          getDiscoveredTools(): MCPToolInfo[];
        };
        if (typeof mcpConn.getDiscoveredTools === "function") {
          const tools = mcpConn.getDiscoveredTools();
          const toolExists = tools.some((t) => t.name === source.operation);
          if (!toolExists) {
            this.log("MCP tool not found on connector", {
              connectorId: source.connectorId,
              tool: source.operation,
              availableTools: tools.map((t) => t.name),
            });
            available = false;
          }
        }
      }

      if (!available) {
        unavailableConnectors.push(source.connectorId);
        if (source.required) {
          this.log("Required connector unavailable", {
            connectorId: source.connectorId,
            operation: source.operation,
          });
        }
      }

      retrievals.push({
        connectorId: source.connectorId,
        operation: source.operation,
        params: source.params,
        available,
        trustLevel,
      });
    }

    const finalizedPlan: FinalizedPlan = {
      retrievals,
      unavailableConnectors,
    };

    const endMs = Date.now();

    // Confidence is lower if there are unavailable required connectors
    const hasUnavailableRequired = dataSourcePlan.dataSources.some(
      (s) =>
        s.required && !retrievals.find(
          (r) => r.connectorId === s.connectorId && r.available,
        ),
    );
    const confidence = hasUnavailableRequired ? 0.5 : 1.0;

    return {
      ...this.createOutput(finalizedPlan, confidence, {
        dataState: "transformed",
        transformations: ["connector-selection"],
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findDataSourcePlan(
    input: AgentInput,
  ): DataSourcePlan | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "context" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("dataSources" in output && "reasoning" in output) {
          return output as unknown as DataSourcePlan;
        }
      }
    }
    return undefined;
  }
}
