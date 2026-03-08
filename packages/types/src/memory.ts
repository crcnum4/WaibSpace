export type MemoryCategory =
  | "profile"
  | "interaction"
  | "task"
  | "relationship"
  | "system";

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  key: string;
  value: unknown;
  createdAt: number;
  updatedAt: number;
  source: string;
}
