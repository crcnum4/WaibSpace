import type {
  WaibEvent,
  AgentOutput,
  AgentCategory,
  MemoryEntry,
} from "@waibspace/types";

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
}
