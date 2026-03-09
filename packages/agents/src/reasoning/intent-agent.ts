import type { AgentOutput } from "@waibspace/types";
import type { ConnectorRegistry, MCPToolInfo } from "@waibspace/connectors";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { NormalizedInput } from "../perception/input-normalizer";

export interface IntentClassification {
  primaryIntent: string;
  intentCategory: string;
  entities: Record<string, string>;
  suggestedAgents: string[];
  confidence: number;
  reasoning: string;
}

const BASE_SYSTEM_PROMPT = `You are an intent classifier for WaibSpace, an AI-powered personal assistant.

Analyze the user's input and classify their intent.`;

const BUILTIN_CAPABILITIES = `
WaibSpace has the following built-in capabilities:
- **Email management**: check inbox, summarize emails, reply to emails, search emails
- **Calendar management**: view upcoming events, check availability, schedule meetings
- **Discovery**: find information, movies, restaurants, services, recommendations
- **Task management**: create tasks, list tasks, complete/update tasks
- **Service connection**: connect Gmail, connect Google Calendar, link accounts, set up integrations`;

const CLASSIFICATION_INSTRUCTIONS = `

For each input, determine:
1. The primary intent (e.g., "check_email", "find_movie", "schedule_meeting", "create_task", "connect_service", "query_data")
2. The intent category (one of: "email", "calendar", "discovery", "task", "connection", "data", "general")
   - Use "data" when the request relates to a connected service that doesn't fit the standard categories
3. Any entities mentioned (e.g., genre, date, time, person, subject, service name)
4. Which downstream agents should handle this (e.g., "context.email", "context.calendar", "ui.discovery", "ui.connection-surface")

When the user wants to connect, link, or set up a service (Gmail, Calendar, email, etc.), classify as:
- primaryIntent: "connect_service"
- intentCategory: "connection"
- entities: include "service" with the service name (e.g., "gmail", "calendar")
- suggestedAgents: ["ui.connection-surface"]
5. Your confidence level (0-1)
6. A brief reasoning explanation

Respond with a JSON object matching the IntentClassification schema.`;

const INTENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    primaryIntent: { type: "string" },
    intentCategory: { type: "string" },
    entities: {
      type: "object",
      additionalProperties: { type: "string" },
    },
    suggestedAgents: {
      type: "array",
      items: { type: "string" },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "string" },
  },
  required: [
    "primaryIntent",
    "intentCategory",
    "entities",
    "suggestedAgents",
    "confidence",
    "reasoning",
  ],
};

export class IntentAgent extends BaseAgent {
  constructor() {
    super({
      id: "reasoning.intent",
      name: "IntentAgent",
      type: "intent-classifier",
      category: "reasoning",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const normalizedInput = this.findNormalizedInput(input);
    const userContent = normalizedInput
      ? normalizedInput.normalizedContent
      : this.fallbackContent(input);

    this.log("Classifying intent", { content: userContent });

    const systemPrompt = this.buildSystemPrompt(context);

    const classification = await this.completeStructured<IntentClassification>(
      context,
      "classification",
      [{ role: "user", content: userContent }],
      INTENT_SCHEMA,
      systemPrompt,
    );

    const endMs = Date.now();

    return {
      ...this.createOutput(classification, classification.confidence, {
        dataState: "transformed",
        transformations: ["intent-classification"],
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  /**
   * Build system prompt dynamically, including capabilities from connected MCP services.
   */
  private buildSystemPrompt(context: AgentContext): string {
    let connectedServices = "";

    const registry = context.config?.["connectorRegistry"] as
      | ConnectorRegistry
      | undefined;

    if (registry) {
      const connectors = registry.getAll();
      const serviceDescriptions: string[] = [];

      for (const connector of connectors) {
        // Skip built-in connectors already covered by BUILTIN_CAPABILITIES
        if (connector.id === "web-fetch") continue;

        const mcpConn = connector as unknown as {
          getDiscoveredTools(): MCPToolInfo[];
        };
        if (typeof mcpConn.getDiscoveredTools === "function") {
          const tools = mcpConn.getDiscoveredTools();
          if (tools.length > 0) {
            const toolSummary = tools
              .slice(0, 5)
              .map((t) => t.description || t.name)
              .join(", ");
            serviceDescriptions.push(
              `- **${connector.name || connector.id}**: ${toolSummary}`,
            );
          }
        }
      }

      if (serviceDescriptions.length > 0) {
        connectedServices = `\n\nAdditionally, the following services are connected and available:\n${serviceDescriptions.join("\n")}`;
      }
    }

    return BASE_SYSTEM_PROMPT + BUILTIN_CAPABILITIES + connectedServices + CLASSIFICATION_INSTRUCTIONS;
  }

  private findNormalizedInput(input: AgentInput): NormalizedInput | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "perception" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("normalizedContent" in output && "inputType" in output) {
          return output as unknown as NormalizedInput;
        }
      }
    }
    return undefined;
  }

  private fallbackContent(input: AgentInput): string {
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload["text"] === "string") {
      return payload["text"];
    }
    return JSON.stringify(input.event.payload ?? "");
  }
}
