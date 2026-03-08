import type {
  AgentOutput,
  ProvenanceMetadata,
  TrustLevel,
  AgentCategory,
} from "@waibspace/types";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

export interface ProvenanceAnnotation {
  agentId: string;
  originalProvenance: ProvenanceMetadata;
  annotatedProvenance: ProvenanceMetadata;
  wasModified: boolean;
}

export interface ProvenanceAnnotationResult {
  annotations: ProvenanceAnnotation[];
  summary: {
    totalOutputs: number;
    trustedCount: number;
    semiTrustedCount: number;
    untrustedCount: number;
  };
}

/**
 * Map known source types to trust levels.
 */
export function assignTrustLevel(sourceType: string): TrustLevel {
  switch (sourceType) {
    case "gmail":
    case "calendar":
    case "oauth-api":
      return "trusted";
    case "mcp-server":
    case "mcp":
      return "semi-trusted";
    case "web-scrape":
    case "web-fetch":
    case "fetch":
      return "untrusted";
    case "memory":
      return "trusted";
    case "inference":
    case "agent":
      return "trusted";
    case "user-input":
      return "trusted";
    default:
      return "semi-trusted";
  }
}

function calculateFreshness(
  timestamp: number,
  now: number,
): ProvenanceMetadata["freshness"] {
  const ageSeconds = (now - timestamp) / 1000;
  if (ageSeconds < 60) return "realtime";
  if (ageSeconds < 300) return "recent";
  if (ageSeconds < 3600) return "stale";
  return "unknown";
}

function defaultSourceTypeForCategory(category: AgentCategory): string {
  switch (category) {
    case "perception":
      return "user-input";
    case "reasoning":
      return "inference";
    case "context":
      return "agent";
    default:
      return "agent";
  }
}

function defaultDataStateForCategory(
  category: AgentCategory,
): ProvenanceMetadata["dataState"] {
  switch (category) {
    case "reasoning":
      return "inferred";
    default:
      return "raw";
  }
}

/**
 * Deterministic safety agent that ensures all prior outputs have complete
 * and accurate provenance metadata attached. Runs after the context/data
 * retrieval phase. No LLM required.
 */
export class ProvenanceAnnotatorAgent extends BaseAgent {
  constructor() {
    super({
      id: "provenance-annotator",
      name: "provenance-annotator",
      type: "safety.provenance-annotator",
      category: "safety",
    });
  }

  async execute(
    input: AgentInput,
    _context: AgentContext,
  ): Promise<AgentOutput> {
    const now = Date.now();
    const { priorOutputs } = input;

    const annotations: ProvenanceAnnotation[] = [];

    for (const prior of priorOutputs) {
      const original: ProvenanceMetadata = { ...prior.provenance };
      const annotated = this.annotate(prior, now);

      const wasModified =
        original.sourceType !== annotated.sourceType ||
        original.trustLevel !== annotated.trustLevel ||
        original.freshness !== annotated.freshness ||
        original.dataState !== annotated.dataState;

      annotations.push({
        agentId: prior.agentId,
        originalProvenance: original,
        annotatedProvenance: annotated,
        wasModified,
      });
    }

    const summary = {
      totalOutputs: annotations.length,
      trustedCount: annotations.filter(
        (a) => a.annotatedProvenance.trustLevel === "trusted",
      ).length,
      semiTrustedCount: annotations.filter(
        (a) => a.annotatedProvenance.trustLevel === "semi-trusted",
      ).length,
      untrustedCount: annotations.filter(
        (a) => a.annotatedProvenance.trustLevel === "untrusted",
      ).length,
    };

    const result: ProvenanceAnnotationResult = { annotations, summary };

    this.log("Provenance annotation complete", summary);

    return this.createOutput(result, 1.0, {
      sourceType: "agent",
      dataState: "transformed",
      transformations: ["provenance-annotation"],
      timestamp: now,
    });
  }

  private annotate(
    prior: AgentOutput,
    now: number,
  ): ProvenanceMetadata {
    const prov = { ...prior.provenance };

    // Fill missing sourceType based on agent category
    if (!prov.sourceType || prov.sourceType === "agent") {
      prov.sourceType = this.resolveSourceType(prior);
    }

    // Assign trust level based on resolved sourceType
    prov.trustLevel = this.resolveTrustLevel(prior, prov.sourceType);

    // Fill dataState if it looks like a default
    if (!prov.dataState) {
      prov.dataState = defaultDataStateForCategory(prior.category);
    }

    // Recalculate freshness based on current time
    prov.freshness = calculateFreshness(prov.timestamp, now);

    return prov;
  }

  private resolveSourceType(prior: AgentOutput): string {
    // For context agents, inspect the output for connector info
    if (prior.category === "context") {
      return this.inferContextSourceType(prior.output);
    }
    return defaultSourceTypeForCategory(prior.category);
  }

  private resolveTrustLevel(
    prior: AgentOutput,
    sourceType: string,
  ): TrustLevel {
    // For context agents, derive trust from connector details in output
    if (prior.category === "context") {
      return assignTrustLevel(sourceType);
    }

    // Perception agents: user input is trusted
    if (prior.category === "perception") {
      return "trusted";
    }

    // Reasoning agents: internal inference is trusted
    if (prior.category === "reasoning") {
      return "trusted";
    }

    // Fall back to source-type based assignment
    return assignTrustLevel(sourceType);
  }

  /**
   * Inspect context agent output for connector metadata to determine source type.
   */
  private inferContextSourceType(output: unknown): string {
    if (output == null || typeof output !== "object") return "agent";
    const obj = output as Record<string, unknown>;

    // Check for connector/source hints in the output
    const connectorType =
      typeof obj.connectorType === "string"
        ? obj.connectorType
        : typeof obj.connector === "string"
          ? obj.connector
          : typeof obj.source === "string"
            ? obj.source
            : undefined;

    if (connectorType) {
      const lower = connectorType.toLowerCase();
      if (lower.includes("gmail") || lower.includes("calendar"))
        return "oauth-api";
      if (lower.includes("mcp")) return "mcp-server";
      if (lower.includes("web") || lower.includes("fetch"))
        return "web-fetch";
      if (lower.includes("memory")) return "memory";
      return connectorType;
    }

    return "agent";
  }
}
