import type { ProvenanceMetadata } from "./provenance";

export type AgentCategory =
  | "perception"
  | "reasoning"
  | "context"
  | "ui"
  | "safety"
  | "execution";

export interface AgentOutput {
  agentId: string;
  agentType: string;
  category: AgentCategory;
  output: unknown;
  confidence: number;
  provenance: ProvenanceMetadata;
  timing: { startMs: number; endMs: number; durationMs: number };
}
