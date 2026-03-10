import type {
  WaibEvent,
  AgentOutput,
  AgentCategory,
  MemoryEntry,
} from "@waibspace/types";
import type { ModelProviderRegistry } from "@waibspace/model-provider";

export interface Agent {
  id: string;
  name: string;
  type: string;
  category: AgentCategory;
  execute(input: AgentInput, context: AgentContext): Promise<AgentOutput>;
}

export interface AgentInput {
  event: WaibEvent;
  priorOutputs: AgentOutput[];
}

export interface AgentContext {
  traceId: string;
  memory?: MemoryEntry[];
  config?: Record<string, unknown>;
  /** Optional model provider registry for agents that need LLM access */
  modelProvider?: ModelProviderRegistry;
}

/**
 * Well-known config keys for memory tiers.
 * These are passed via context.config by the backend.
 */
export interface MemoryTierConfig {
  /** Legacy flat memory store */
  memoryStore?: unknown;
  /** Per-pipeline ephemeral scratch space */
  shortTermMemory?: unknown;
  /** SQLite domain-scoped working knowledge */
  midTermMemory?: unknown;
  /** SQLite FTS5 keyword-indexed long-term recall */
  longTermMemory?: unknown;
  /** ShortTermMemoryManager for creating per-trace stores */
  shortTermMemoryManager?: unknown;
}
