import type { AgentOutput } from "@waibspace/types";
import type { ConnectorRegistry, MCPToolInfo } from "@waibspace/connectors";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { IntentClassification } from "../reasoning/intent-agent";

export interface DataSourcePlan {
  dataSources: Array<{
    connectorId: string;
    operation: string;
    params: Record<string, unknown>;
    priority: number;
    required: boolean;
  }>;
  reasoning: string;
}

const BASE_SYSTEM_PROMPT = `You are a context planning agent for WaibSpace, an AI-powered personal assistant.

Given an intent classification, determine which data sources need to be queried to fulfill the user's request.

IMPORTANT: Only use connectorId values that appear in the "Available connectors" list below. Do NOT invent connector IDs.`;

const SYSTEM_PROMPT_SUFFIX = `

Guidelines:
- Examine the available connectors and their tools carefully. Use tool descriptions and parameter schemas to determine the best tools for the user's intent.
- Plan MULTIPLE operations if needed to get comprehensive data (e.g., one for fetching items + one for counts/stats).
- For email/inbox intents, prioritize fetching multiple recent or unread messages, not just one.
- Set priority=1 for the most important data source, higher numbers for supplementary sources.
- Set required=true for essential data, false for nice-to-have context.
- For "briefing" intents: query ALL available connectors to build a comprehensive overview. Every connected service should have at least one data retrieval operation planned. This is a full scan.

For each data source needed, specify:
- connectorId: which connector to use (MUST match an ID from the available connectors list above)
- operation: which operation/tool to call
- params: parameters for the operation
- priority: 1 = highest priority, higher numbers = lower priority
- required: true if the data is essential, false if supplementary

Respond with a JSON object matching the DataSourcePlan schema.`;

const DATA_SOURCE_PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    dataSources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          connectorId: { type: "string" },
          operation: { type: "string" },
          params: { type: "object", additionalProperties: true },
          priority: { type: "number", minimum: 1 },
          required: { type: "boolean" },
        },
        required: ["connectorId", "operation", "params", "priority", "required"],
      },
    },
    reasoning: { type: "string" },
  },
  required: ["dataSources", "reasoning"],
};

export class ContextPlannerAgent extends BaseAgent {
  constructor() {
    super({
      id: "context.planner",
      name: "ContextPlannerAgent",
      type: "context-planner",
      category: "context",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const intentClassification = this.findIntentClassification(input);
    if (!intentClassification) {
      return this.createOutput(
        { dataSources: [], reasoning: "No intent classification available" },
        0,
        { dataState: "raw", timestamp: startMs },
      );
    }

    this.log("Planning data sources for intent", {
      intent: intentClassification.primaryIntent,
      category: intentClassification.intentCategory,
    });

    // Build system prompt with all available connectors (native + MCP)
    const connectorsSection = this.buildConnectorsPromptSection(context);
    const systemPrompt = BASE_SYSTEM_PROMPT + connectorsSection + SYSTEM_PROMPT_SUFFIX;

    const userMessage = [
      `Intent: ${intentClassification.primaryIntent}`,
      `Category: ${intentClassification.intentCategory}`,
      `Entities: ${JSON.stringify(intentClassification.entities)}`,
      `Suggested agents: ${intentClassification.suggestedAgents.join(", ")}`,
      `Reasoning: ${intentClassification.reasoning}`,
    ].join("\n");

    const plan = await this.completeStructured<DataSourcePlan>(
      context,
      "reasoning",
      [{ role: "user", content: userMessage }],
      DATA_SOURCE_PLAN_SCHEMA,
      systemPrompt,
    );

    const endMs = Date.now();

    return {
      ...this.createOutput(plan, 0.85, {
        dataState: "transformed",
        transformations: ["context-planning"],
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findIntentClassification(
    input: AgentInput,
  ): IntentClassification | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "reasoning" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("primaryIntent" in output && "intentCategory" in output) {
          return output as unknown as IntentClassification;
        }
      }
    }
    return undefined;
  }

  /**
   * Build a prompt section describing ALL available connectors by querying
   * the ConnectorRegistry. Lists native connectors with known operations
   * and MCP connectors with their discovered tools.
   */
  private buildConnectorsPromptSection(context: AgentContext): string {
    const registry = context.config?.["connectorRegistry"] as
      | ConnectorRegistry
      | undefined;
    if (!registry) {
      return "";
    }

    const allConnectors = registry.getAll();
    if (allConnectors.length === 0) {
      return "\n\nNo connectors available.";
    }

    const sections: string[] = [];

    for (const connector of allConnectors) {
      // Check if it's an MCP connector with discovered tools
      const mcpConn = connector as unknown as {
        getDiscoveredTools(): MCPToolInfo[];
      };
      if (typeof mcpConn.getDiscoveredTools === "function") {
        const tools = mcpConn.getDiscoveredTools();
        if (tools.length > 0) {
          const toolLines = tools.map((tool) => {
            const desc = tool.description ? `: ${tool.description}` : "";
            const schema = tool.inputSchema
              ? `. Params: ${JSON.stringify(tool.inputSchema)}`
              : "";
            return `  - ${tool.name}${desc}${schema}`;
          });
          sections.push(
            `\n- **${connector.id}** (MCP, ${connector.type}):\n${toolLines.join("\n")}`,
          );
        }
      } else {
        // Native connector — list known actions from capabilities
        const actions = connector.capabilities?.actions ?? [];
        if (actions.length > 0) {
          const actionLines = actions.map((a: string) => `  - ${a}`);
          sections.push(
            `\n- **${connector.id}** (${connector.type}):\n${actionLines.join("\n")}`,
          );
        } else {
          sections.push(`\n- **${connector.id}** (${connector.type})`);
        }
      }
    }

    this.log("Available connectors for planning", {
      total: sections.length,
      ids: allConnectors.map((c) => c.id),
    });

    return `\n\nAvailable connectors:\n${sections.join("")}`;
  }
}
