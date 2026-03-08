import type { AgentOutput, ProvenanceMetadata } from "@waibspace/types";
import type {
  ConnectorRegistry,
  ConnectorResponse,
} from "@waibspace/connectors";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { FinalizedPlan } from "./connector-selection";

interface RetrievalResult {
  connectorId: string;
  operation: string;
  status: "fulfilled" | "rejected";
  data?: unknown;
  provenance?: ProvenanceMetadata;
  error?: string;
}

export interface DataRetrievalOutput {
  results: RetrievalResult[];
  totalAttempted: number;
  totalSucceeded: number;
  totalFailed: number;
}

export class DataRetrievalAgent extends BaseAgent {
  constructor() {
    super({
      id: "context.data-retrieval",
      name: "DataRetrievalAgent",
      type: "data-retriever",
      category: "context",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const finalizedPlan = this.findFinalizedPlan(input);
    if (!finalizedPlan) {
      return this.createOutput(
        { results: [], totalAttempted: 0, totalSucceeded: 0, totalFailed: 0 },
        0,
        { dataState: "raw", timestamp: startMs },
      );
    }

    const registry = context.config?.["connectorRegistry"] as
      | ConnectorRegistry
      | undefined;
    if (!registry) {
      throw new Error(
        "DataRetrievalAgent requires connectorRegistry in context.config",
      );
    }

    const availableRetrievals = finalizedPlan.retrievals.filter(
      (r) => r.available,
    );

    this.log("Executing retrievals", {
      total: finalizedPlan.retrievals.length,
      available: availableRetrievals.length,
    });

    const settlementResults = await Promise.allSettled(
      availableRetrievals.map(async (retrieval) => {
        const connector = registry.get(retrieval.connectorId);
        if (!connector) {
          throw new Error(
            `Connector "${retrieval.connectorId}" not found in registry`,
          );
        }

        const response: ConnectorResponse = await connector.fetch({
          operation: retrieval.operation,
          params: retrieval.params,
          traceId: context.traceId,
        });

        return {
          connectorId: retrieval.connectorId,
          operation: retrieval.operation,
          data: this.truncateData(response.data),
          provenance: response.provenance,
        };
      }),
    );

    const results: RetrievalResult[] = settlementResults.map(
      (result, index) => {
        const retrieval = availableRetrievals[index];
        if (result.status === "fulfilled") {
          return {
            connectorId: retrieval.connectorId,
            operation: retrieval.operation,
            status: "fulfilled" as const,
            data: result.value.data,
            provenance: result.value.provenance,
          };
        } else {
          this.log("Retrieval failed", {
            connectorId: retrieval.connectorId,
            operation: retrieval.operation,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
          return {
            connectorId: retrieval.connectorId,
            operation: retrieval.operation,
            status: "rejected" as const,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          };
        }
      },
    );

    const totalSucceeded = results.filter(
      (r) => r.status === "fulfilled",
    ).length;

    const output: DataRetrievalOutput = {
      results,
      totalAttempted: availableRetrievals.length,
      totalSucceeded,
      totalFailed: availableRetrievals.length - totalSucceeded,
    };

    const endMs = Date.now();

    const confidence =
      availableRetrievals.length > 0
        ? totalSucceeded / availableRetrievals.length
        : 0;

    return {
      ...this.createOutput(output, confidence, {
        sourceType: "connector",
        dataState: "raw",
        freshness: "realtime",
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
   * Truncate large data to prevent blowing up LLM token limits.
   * MCP tools can return megabytes of data (e.g. all unseen emails).
   * Cap at ~50KB which is roughly 12k tokens.
   */
  private truncateData(data: unknown): unknown {
    const MAX_DATA_SIZE = 50_000;

    // MCP tools return [{type: "text", text: "..."}] — truncate the text content
    if (Array.isArray(data)) {
      return data.map((item: unknown) => {
        if (
          typeof item === "object" &&
          item !== null &&
          (item as Record<string, unknown>).type === "text" &&
          typeof (item as Record<string, unknown>).text === "string"
        ) {
          const text = (item as Record<string, string>).text;
          if (text.length > MAX_DATA_SIZE) {
            // Try to parse as JSON array and take first N items
            try {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                let truncated = parsed.slice(0, 20);
                let serialized = JSON.stringify(truncated);
                while (serialized.length > MAX_DATA_SIZE && truncated.length > 1) {
                  truncated = truncated.slice(0, Math.ceil(truncated.length / 2));
                  serialized = JSON.stringify(truncated);
                }
                return { type: "text", text: serialized };
              }
            } catch {
              // Not JSON, just truncate raw text
            }
            return { type: "text", text: text.slice(0, MAX_DATA_SIZE) + "\n...[truncated]" };
          }
        }
        return item;
      });
    }

    const str = JSON.stringify(data);
    if (str.length > MAX_DATA_SIZE) {
      return JSON.parse(str.slice(0, MAX_DATA_SIZE));
    }
    return data;
  }

  private findFinalizedPlan(
    input: AgentInput,
  ): FinalizedPlan | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "context" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("retrievals" in output && "unavailableConnectors" in output) {
          return output as unknown as FinalizedPlan;
        }
      }
    }
    return undefined;
  }
}
