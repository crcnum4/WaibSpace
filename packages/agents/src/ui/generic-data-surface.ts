import type { AgentOutput } from "@waibspace/types";
import { SurfaceFactory } from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";

/**
 * Structured presentation the LLM produces from arbitrary MCP data.
 */
interface GenericDataPresentation {
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    items: Array<{
      label: string;
      detail?: string;
      metadata?: Record<string, string>;
      timestamp?: string;
      url?: string;
    }>;
  }>;
}

/**
 * Patterns handled by specialized surface agents.
 * Results matching these are excluded so we don't duplicate rendering.
 */
const SPECIALIZED_CONNECTOR_PATTERNS = ["gmail", "mail", "google-calendar", "web-fetch"];
const SPECIALIZED_OPERATION_PATTERNS = [
  "email", "message", "inbox", "unseen", "recent",
  "calendar", "event",
  "search", "fetch",
];

const SYSTEM_PROMPT = `You are a data presentation agent for WaibSpace, an AI-powered personal assistant.

Given raw data from an external service (MCP tool), analyze what the data represents and create a structured presentation suitable for display.

Return a JSON object with:
- title: A concise, descriptive title (e.g., "Recent Slack Messages", "GitHub Pull Requests", "Open Issues")
- summary: A brief 1-2 sentence summary of the data
- sections: Array of logical sections, each with:
  - heading: Section title
  - items: Array of items, each with:
    - label: Primary display text
    - detail: Secondary/descriptive text (optional)
    - metadata: Key-value pairs for badges/tags, e.g. {"status": "open", "priority": "high"} (optional)
    - timestamp: ISO date string if applicable (optional)
    - url: Link if applicable (optional)

Guidelines:
- Group related items into meaningful sections
- Extract the most relevant fields from the raw data for label/detail
- Use metadata for categorical fields (status, type, priority, etc.)
- Keep labels concise but informative
- If the data is a single object, create one section with one item
- If the data is a list, create sections by logical grouping (or one section if items are similar)`;

const PRESENTATION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                detail: { type: "string" },
                metadata: { type: "object", additionalProperties: { type: "string" } },
                timestamp: { type: "string" },
                url: { type: "string" },
              },
              required: ["label"],
            },
          },
        },
        required: ["heading", "items"],
      },
    },
  },
  required: ["title", "summary", "sections"],
};

export class GenericDataSurfaceAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.generic-data-surface",
      name: "GenericDataSurfaceAgent",
      type: "surface-builder",
      category: "ui",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const retrievalOutput = this.findDataRetrieval(input);
    if (!retrievalOutput) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    // Find results NOT claimed by specialized surface agents
    const unclaimedResults = retrievalOutput.results.filter((r) => {
      if (r.status !== "fulfilled") return false;

      const connId = r.connectorId.toLowerCase();
      const op = r.operation.toLowerCase();

      // Exclude results that specialized agents handle
      const isSpecializedConnector = SPECIALIZED_CONNECTOR_PATTERNS.some(
        (p) => connId.includes(p),
      );
      const isSpecializedOp = SPECIALIZED_OPERATION_PATTERNS.some(
        (p) => op.includes(p),
      );

      return !isSpecializedConnector && !isSpecializedOp;
    });

    if (unclaimedResults.length === 0) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    this.log("Processing unclaimed MCP data", {
      unclaimedCount: unclaimedResults.length,
      connectors: unclaimedResults.map((r) => `${r.connectorId}:${r.operation}`),
    });

    // Parse MCP content and combine data from all unclaimed results
    const parsedResults: Array<{ connectorId: string; operation: string; data: unknown }> = [];
    for (const result of unclaimedResults) {
      const parsed = this.parseMCPContent(result.data);
      parsedResults.push({
        connectorId: result.connectorId,
        operation: result.operation,
        data: parsed ?? result.data,
      });
    }

    // Truncate data to keep within token limits
    const truncatedData = this.truncateData(parsedResults);

    // Extract user intent for context
    const userIntent = this.extractUserIntent(input);

    const userMessage = JSON.stringify({
      userQuery: userIntent,
      data: truncatedData,
    });

    const presentation = await this.completeStructured<GenericDataPresentation>(
      context,
      "summarization",
      [{ role: "user", content: userMessage }],
      PRESENTATION_SCHEMA,
      SYSTEM_PROMPT,
    );

    const endMs = Date.now();

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
      transformations: ["generic-data-structuring"],
    };

    const surfaceSpec = SurfaceFactory.generic(
      presentation.title,
      presentation,
      provenance,
    );

    return {
      ...this.createOutput(
        { surfaceSpec, summary: presentation.summary },
        0.8,
        provenance,
      ),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findDataRetrieval(
    input: AgentInput,
  ): DataRetrievalOutput | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "context" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("results" in output && "totalAttempted" in output) {
          return output as unknown as DataRetrievalOutput;
        }
      }
    }
    return undefined;
  }

  private extractUserIntent(input: AgentInput): string {
    // Try to find the original user message
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload["text"] === "string") {
      return payload["text"];
    }
    // Fall back to intent classification
    for (const prior of input.priorOutputs) {
      if (prior.category === "reasoning" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("primaryIntent" in output) {
          return String(output.primaryIntent);
        }
      }
    }
    return "show data";
  }

  /**
   * Parse MCP tool response format: [{type: "text", text: "...json..."}]
   */
  private parseMCPContent(data: unknown): unknown | undefined {
    if (!Array.isArray(data)) return undefined;
    const textBlock = data.find(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).type === "text",
    );
    if (!textBlock) return undefined;
    const text = (textBlock as Record<string, unknown>).text;
    if (typeof text !== "string") return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Truncate data to keep within LLM token limits.
   */
  private truncateData(data: unknown[]): unknown[] {
    const MAX_TOTAL_LENGTH = 40_000;
    const serialized = JSON.stringify(data);
    if (serialized.length <= MAX_TOTAL_LENGTH) return data;

    // Truncate arrays within each result
    return data.map((item) => {
      const entry = item as Record<string, unknown>;
      const entryData = entry.data;
      if (Array.isArray(entryData)) {
        return { ...entry, data: entryData.slice(0, 15) };
      }
      return entry;
    });
  }
}
