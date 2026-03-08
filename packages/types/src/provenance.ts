export type TrustLevel = "trusted" | "semi-trusted" | "untrusted";
export type DataState = "raw" | "summarized" | "inferred" | "transformed";

export interface ProvenanceMetadata {
  sourceType: string;
  sourceId: string;
  trustLevel: TrustLevel;
  timestamp: number;
  freshness: "realtime" | "recent" | "stale" | "unknown";
  dataState: DataState;
  transformations?: string[];
  relatedEventId?: string;
}
