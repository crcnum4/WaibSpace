import type { AgentOutput } from "@waibspace/types";
import {
  SurfaceFactory,
  type SearchSurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";
import type { IntentClassification } from "../reasoning/intent-agent";

/**
 * Structured search result the LLM produces from raw connector data.
 */
interface SearchAnalysis {
  query: string;
  results: Array<{
    id: string;
    title: string;
    snippet: string;
    source: string;
    sourceType: string;
    date?: string;
    url?: string;
    relevanceScore: number;
    metadata?: Record<string, string>;
  }>;
}

const SYSTEM_PROMPT = `You are a unified search agent for WaibSpace, an AI-powered personal assistant.

Given raw data from multiple services (email, calendar, etc.) and a search query, analyze the data and return unified search results ranked by relevance.

For each result:
1. Generate a concise title
2. Write a brief snippet summarizing the content
3. Identify the source service (e.g., "Gmail", "Google Calendar")
4. Identify the source type (e.g., "email", "calendar-event")
5. Extract relevant dates
6. Score relevance from 0 to 1
7. Extract metadata tags (e.g., {"from": "alice@example.com", "status": "unread"})

Return a JSON object with:
- query: the original search query
- results: array of results sorted by relevance (highest first)`;

const SEARCH_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    query: { type: "string" },
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          snippet: { type: "string" },
          source: { type: "string" },
          sourceType: { type: "string" },
          date: { type: "string" },
          url: { type: "string" },
          relevanceScore: { type: "number", minimum: 0, maximum: 1 },
          metadata: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["id", "title", "snippet", "source", "sourceType", "relevanceScore"],
      },
    },
  },
  required: ["query", "results"],
};

export class SearchSurfaceAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.search-surface",
      name: "SearchSurfaceAgent",
      type: "surface-builder",
      category: "ui",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    // Only activate for search intents
    const intent = this.findIntentClassification(input);
    if (!intent || !this.isSearchIntent(intent)) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    const retrievalOutput = this.findDataRetrieval(input);
    if (!retrievalOutput) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    // Gather all fulfilled results from any connector
    const allResults = retrievalOutput.results.filter(
      (r) => r.status === "fulfilled" && r.data,
    );

    if (allResults.length === 0) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    this.log("Building search surface", {
      query: intent.primaryIntent,
      resultSources: allResults.map((r) => `${r.connectorId}:${r.operation}`),
    });

    // Parse MCP content and combine data
    const parsedResults: Array<{
      connectorId: string;
      operation: string;
      data: unknown;
    }> = [];
    for (const result of allResults) {
      const parsed = this.parseMCPContent(result.data);
      parsedResults.push({
        connectorId: result.connectorId,
        operation: result.operation,
        data: parsed ?? result.data,
      });
    }

    // Truncate data to keep within token limits
    const truncatedData = this.truncateData(parsedResults);

    const userQuery = this.extractUserQuery(input);
    const userMessage = JSON.stringify({
      searchQuery: userQuery,
      intent: intent.primaryIntent,
      data: truncatedData,
    });

    const analysis = await this.completeStructured<SearchAnalysis>(
      context,
      "summarization",
      [{ role: "user", content: userMessage }],
      SEARCH_ANALYSIS_SCHEMA,
      SYSTEM_PROMPT,
    );

    const sources = [
      ...new Set(allResults.map((r) => r.connectorId)),
    ];

    const surfaceData: SearchSurfaceData = {
      query: analysis.query,
      results: analysis.results,
      totalResults: analysis.results.length,
      sources,
    };

    const endMs = Date.now();

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
      transformations: ["search-ranking", "snippet-generation"],
    };

    const surfaceSpec = SurfaceFactory.search(surfaceData, provenance);

    return {
      ...this.createOutput(
        { surfaceSpec, summary: `${analysis.results.length} results for "${analysis.query}"` },
        0.9,
        provenance,
      ),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private isSearchIntent(intent: IntentClassification): boolean {
    const searchKeywords = ["search", "find", "look for", "look up", "query", "where is", "locate"];
    const intentLower = intent.primaryIntent.toLowerCase();
    return (
      intent.intentCategory === "search" ||
      searchKeywords.some((kw) => intentLower.includes(kw))
    );
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

  private extractUserQuery(input: AgentInput): string {
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload["text"] === "string") {
      return payload["text"];
    }
    for (const prior of input.priorOutputs) {
      if (prior.category === "reasoning" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("primaryIntent" in output) {
          return String(output.primaryIntent);
        }
      }
    }
    return "search";
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
