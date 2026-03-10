/**
 * DataTriageAgent — generic triage agent with pluggable classifiers.
 *
 * Sits between the context phase (data-retrieval) and the UI phase.
 * For each retrieval result, it finds a matching classifier and produces
 * a TriageOutput with urgency/category annotations on every item.
 */

import type { AgentOutput } from "@waibspace/types";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";
import type {
  TriageClassifier,
  TriageOutput,
  TriagedItem,
  UrgencyLevel,
  TriageCategory,
} from "./types";

export class DataTriageAgent extends BaseAgent {
  private classifiers = new Map<string, TriageClassifier>();

  constructor() {
    super({
      id: "triage.data-classifier",
      name: "DataTriageAgent",
      type: "classifier",
      category: "triage",
    });
  }

  /** Register a classifier for a set of connector types. */
  registerClassifier(classifier: TriageClassifier): void {
    this.classifiers.set(classifier.id, classifier);
    this.log("Classifier registered", {
      classifierId: classifier.id,
      connectors: classifier.supportedConnectors,
    });
  }

  /**
   * Find a classifier whose supportedConnectors matches the given connectorId.
   * Uses case-insensitive partial matching so "gmail" matches "gmail-personal".
   */
  private findClassifier(connectorId: string): TriageClassifier | undefined {
    const lower = connectorId.toLowerCase();
    for (const classifier of this.classifiers.values()) {
      const matches = classifier.supportedConnectors.some((supported) =>
        lower.includes(supported.toLowerCase()),
      );
      if (matches) return classifier;
    }
    return undefined;
  }

  async execute(
    input: AgentInput,
    _context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    // Find DataRetrievalOutput from prior outputs
    const retrievalOutput = input.priorOutputs.find(
      (o) => o.category === "context" && this.isDataRetrievalOutput(o.output),
    );

    if (!retrievalOutput) {
      this.log("No data retrieval output found, skipping triage");
      return this.createOutput([], 0.5);
    }

    const retrieval = retrievalOutput.output as DataRetrievalOutput;
    const triageOutputs: TriageOutput[] = [];

    for (const result of retrieval.results) {
      if (result.status !== "fulfilled" || !result.data) continue;

      const classifier = this.findClassifier(result.connectorId);
      if (!classifier) {
        this.log("No classifier for connector, skipping", {
          connectorId: result.connectorId,
        });
        continue;
      }

      // Normalize data to an array
      const rawItems = Array.isArray(result.data)
        ? (result.data as unknown[])
        : [result.data];

      if (rawItems.length === 0) continue;

      try {
        const triageResults = await classifier.classify(rawItems);

        // Pair raw items with their triage results
        const items: TriagedItem[] = rawItems.map((raw, i) => ({
          raw,
          triage: triageResults[i]!,
        }));

        // Compute stats
        const byUrgency: Record<UrgencyLevel, number> = {
          high: 0,
          medium: 0,
          low: 0,
        };
        const byCategory: Record<TriageCategory, number> = {
          actionable: 0,
          informational: 0,
          promotional: 0,
          personal: 0,
          professional: 0,
        };

        for (const item of items) {
          byUrgency[item.triage.urgency]++;
          byCategory[item.triage.category]++;
        }

        triageOutputs.push({
          items,
          stats: {
            total: items.length,
            byUrgency,
            byCategory,
          },
          classifierId: classifier.id,
          connectorId: result.connectorId,
        });

        this.log("Triage complete for connector", {
          connectorId: result.connectorId,
          classifierId: classifier.id,
          total: items.length,
          highUrgency: byUrgency.high,
        });
      } catch (err) {
        this.log("Classifier error", {
          connectorId: result.connectorId,
          classifierId: classifier.id,
          error: String(err),
        });
      }
    }

    const endMs = Date.now();
    const output = this.createOutput(triageOutputs, 0.8);
    output.timing = {
      startMs,
      endMs,
      durationMs: endMs - startMs,
    };
    return output;
  }

  private isDataRetrievalOutput(output: unknown): output is DataRetrievalOutput {
    if (!output || typeof output !== "object") return false;
    const obj = output as Record<string, unknown>;
    return Array.isArray(obj.results);
  }
}
