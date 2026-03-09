export type MemoryCategory =
  | "profile"
  | "interaction"
  | "task"
  | "relationship"
  | "system"
  | "conversation"
  | "engagement";

/**
 * A single turn in a conversation history.
 */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  traceId: string;
}

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  key: string;
  value: unknown;
  createdAt: number;
  updatedAt: number;
  source: string;
}
