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
  metadata?: Record<string, unknown>;
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

        this.log("Fetching from connector", {
          connectorId: retrieval.connectorId,
          operation: retrieval.operation,
          params: retrieval.params,
        });

        const response: ConnectorResponse = await connector.fetch({
          operation: retrieval.operation,
          params: retrieval.params,
          traceId: context.traceId,
        });

        const truncated = this.truncateData(response.data);

        // Log response shape for debugging MCP data flow
        const dataShape = Array.isArray(truncated)
          ? `array[${truncated.length}]`
          : typeof truncated;
        this.log("Received data", {
          connectorId: retrieval.connectorId,
          operation: retrieval.operation,
          dataShape,
        });

        return {
          connectorId: retrieval.connectorId,
          operation: retrieval.operation,
          data: truncated,
          provenance: response.provenance,
          metadata: response.metadata,
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
            metadata: result.value.metadata,
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
    const MAX_ITEMS = 10;
    const MAX_FIELD_LENGTH = 500;

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
                // Take first N items, then strip large fields from each
                const truncated = parsed.slice(0, MAX_ITEMS).map((entry: unknown) => {
                  if (typeof entry === "object" && entry !== null) {
                    return this.trimBodyFields(
                      entry as Record<string, unknown>,
                      MAX_FIELD_LENGTH,
                    );
                  }
                  return entry;
                });

                // Log sample fields for debugging MCP data quality
                const sample = truncated[0] as Record<string, unknown> | undefined;
                this.log("Truncated MCP array data", {
                  originalCount: parsed.length,
                  keptCount: truncated.length,
                  serializedSize: JSON.stringify(truncated).length,
                  sampleFields: sample ? Object.keys(sample) : [],
                });

                return { type: "text", text: JSON.stringify(truncated) };
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

  /**
   * Trim only body/content fields in an object to keep data compact.
   * Preserves ALL other fields exactly as-is (from, subject, to, date, etc.)
   * so downstream agents receive unmangled header data.
   *
   * Only these known body field names are truncated:
   * text, html, body, content, snippet, textBody, htmlBody
   */
  private static readonly BODY_FIELDS = new Set([
    "text", "html", "body", "content", "snippet", "textBody", "htmlBody",
  ]);

  private trimBodyFields(
    obj: Record<string, unknown>,
    maxLen: number,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        DataRetrievalAgent.BODY_FIELDS.has(key) &&
        typeof value === "string" &&
        value.length > maxLen
      ) {
        result[key] = value.slice(0, maxLen) + "...";
      } else {
        // Preserve everything else exactly as-is — no recursive trimming
        result[key] = value;
      }
    }
    return result;
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
