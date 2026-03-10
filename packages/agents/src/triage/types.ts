export type UrgencyLevel = "high" | "medium" | "low";
export type TriageCategory =
  | "actionable"
  | "informational"
  | "promotional"
  | "personal"
  | "professional";

export interface TriageResult {
  itemId: string;
  urgency: UrgencyLevel;
  category: TriageCategory;
  suggestedAction?: string; // e.g., "mark_read", "reply", "archive", "unsubscribe"
  confidence: number; // 0-1
  reasoning?: string; // why this classification
  domain?: string; // memory domain hint
}

export interface TriagedItem<T = unknown> {
  raw: T;
  triage: TriageResult;
}

export interface TriageClassifier {
  /** Unique identifier for this classifier */
  id: string;
  /** Which connector types this classifier handles */
  supportedConnectors: string[];
  /** Classify a batch of raw items */
  classify(items: unknown[], context?: TriageContext): Promise<TriageResult[]>;
}

export interface TriageContext {
  /** Memory context for informed classification */
  memoryContext?: string;
  /** Known domains for this data source */
  domains?: string[];
}

export interface AutoAction {
  type: string; // "mark_read", "archive", "store_memory", "unsubscribe_recommend"
  target: string; // item ID or identifier
  metadata?: Record<string, unknown>;
}

export interface MemoryCandidate {
  domain: string;
  key: string;
  summary: string;
}

export interface TriageOutput {
  items: TriagedItem[];
  stats: {
    total: number;
    byUrgency: Record<UrgencyLevel, number>;
    byCategory: Record<TriageCategory, number>;
  };
  classifierId: string;
  connectorId: string;
  /** Auto-tier actions safe to execute without user approval. */
  autoActions?: AutoAction[];
  /** Summaries extracted for mid-term memory storage. */
  memoryCandidates?: MemoryCandidate[];
}
