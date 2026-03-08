import type { AgentOutput } from "@waibspace/types";
import type { SurfaceAction } from "@waibspace/types";
import {
  SurfaceFactory,
  type DiscoverySurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";
import type { IntentClassification } from "../reasoning/intent-agent";

interface RankedResult {
  title: string;
  description: string;
  url?: string;
  relevanceScore: number;
  matchReasons: string[];
  suggestedActions: Array<{
    label: string;
    actionType: string;
  }>;
}

interface DiscoveryAnalysis {
  query: string;
  rankedResults: RankedResult[];
}

const SYSTEM_PROMPT = `You are a discovery/search results agent for WaibSpace, an AI-powered personal assistant.

Given web acquisition data and an intent classification, perform the following:
1. Rank results by relevance to the user's original query/intent
2. Generate concise, helpful descriptions for each result
3. Identify match reasons explaining why each result is relevant
4. Suggest contextual actions for each result (e.g., "Open", "Save", "Share", "Add to Calendar")

Return a JSON object with:
- query: the original search query or intent description
- rankedResults: array of results sorted by relevance, each with title, description, optional url, relevanceScore (0-1), matchReasons, and suggestedActions`;

const DISCOVERY_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    query: { type: "string" },
    rankedResults: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          url: { type: "string" },
          relevanceScore: { type: "number", minimum: 0, maximum: 1 },
          matchReasons: {
            type: "array",
            items: { type: "string" },
          },
          suggestedActions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                actionType: { type: "string" },
              },
              required: ["label", "actionType"],
            },
          },
        },
        required: ["title", "description", "relevanceScore", "matchReasons", "suggestedActions"],
      },
    },
  },
  required: ["query", "rankedResults"],
};

export class DiscoverySurfaceAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.discovery-surface",
      name: "DiscoverySurfaceAgent",
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
    const intentClassification = this.findIntentClassification(input);

    if (!retrievalOutput) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    const webData = this.extractWebData(retrievalOutput);

    this.log("Building discovery surface", {
      resultCount: Array.isArray(webData) ? webData.length : 0,
      hasIntent: intentClassification !== undefined,
    });

    const userMessage = JSON.stringify({
      webResults: webData,
      intent: intentClassification,
    });

    const analysis = await this.completeStructured<DiscoveryAnalysis>(
      context,
      "summarization",
      [{ role: "user", content: userMessage }],
      DISCOVERY_ANALYSIS_SCHEMA,
      SYSTEM_PROMPT,
    );

    const sources = retrievalOutput.results
      .filter((r) => r.status === "fulfilled" && r.provenance)
      .map((r) => r.provenance!);

    const surfaceData: DiscoverySurfaceData = {
      query: analysis.query,
      results: analysis.rankedResults.map((r) => ({
        title: r.title,
        description: r.description,
        url: r.url,
        relevanceScore: r.relevanceScore,
        matchReasons: r.matchReasons,
        actions: r.suggestedActions.map(
          (a, i): SurfaceAction => ({
            id: `action-${i}`,
            label: a.label,
            actionType: a.actionType,
            riskClass: "A",
          }),
        ),
      })),
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
      transformations: ["relevance-ranking", "description-generation"],
    };

    const surfaceSpec = SurfaceFactory.discovery(surfaceData, provenance);

    return {
      ...this.createOutput(
        { surfaceSpec },
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

  private extractWebData(retrieval: DataRetrievalOutput): unknown {
    const webResults = retrieval.results.filter(
      (r) =>
        r.status === "fulfilled" &&
        (r.connectorId === "web" ||
          r.connectorId === "web-fetch" ||
          r.operation.includes("search") ||
          r.operation.includes("web") ||
          r.operation.includes("fetch")),
    );
    if (webResults.length === 0) return [];
    // Return all web data if multiple results, or the single result's data
    if (webResults.length === 1) return webResults[0].data;
    return webResults.map((r) => r.data);
  }
}
