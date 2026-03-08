import type { AgentOutput } from "@waibspace/types";
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

const SYSTEM_PROMPT = `You are a context planning agent for WaibSpace, an AI-powered personal assistant.

Given an intent classification, determine which data sources need to be queried to fulfill the user's request.

Available connectors and their operations:

- **gmail**:
  - list-emails: List recent emails. Params: maxResults (number), labelIds (string[])
  - get-email: Get a specific email. Params: emailId (string)
  - search-emails: Search emails by query. Params: query (string), maxResults (number)

- **google-calendar**:
  - list-events: List upcoming calendar events. Params: timeMin (string), timeMax (string), maxResults (number)
  - check-availability: Check free/busy status. Params: timeMin (string), timeMax (string)
  - get-event: Get a specific event. Params: eventId (string)

- **web-fetch**:
  - fetch-url: Fetch content from a URL. Params: url (string)
  - search-site: Search a website. Params: query (string), site (string)

For each data source needed, specify:
- connectorId: which connector to use
- operation: which operation to call
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
      throw new Error(
        "ContextPlannerAgent requires IntentClassification from prior outputs",
      );
    }

    this.log("Planning data sources for intent", {
      intent: intentClassification.primaryIntent,
      category: intentClassification.intentCategory,
    });

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
      SYSTEM_PROMPT,
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
}
