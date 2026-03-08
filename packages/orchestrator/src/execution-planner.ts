import type { AgentCategory } from "@waibspace/types";
import type { Agent } from "@waibspace/agents";
import { AgentRegistry } from "./agent-registry";

export interface ExecutionPlan {
  phases: ExecutionPhase[];
}

export interface ExecutionPhase {
  id: string;
  category: AgentCategory;
  agents: Agent[];
}

/**
 * Define the pipeline order based on event type.
 */
function getPipelineForEvent(eventType: string): AgentCategory[] {
  if (
    eventType === "user.message.received" ||
    eventType === "user.intent.url_received"
  ) {
    return ["perception", "reasoning", "context", "ui", "safety"];
  }

  if (eventType.startsWith("user.interaction.")) {
    return ["perception", "reasoning", "context", "ui", "safety"];
  }

  if (eventType === "policy.approval.response") {
    return ["execution"];
  }

  // Default pipeline
  return ["perception", "reasoning", "context", "ui", "safety"];
}

/**
 * Build an execution plan based on event type and registered agents.
 * Each phase contains all agents registered under that category.
 * Phases with no agents are omitted.
 */
export function buildExecutionPlan(
  eventType: string,
  registry: AgentRegistry,
): ExecutionPlan {
  const categories = getPipelineForEvent(eventType);

  const phases: ExecutionPhase[] = [];
  for (const category of categories) {
    const agents = registry.getByCategory(category);
    if (agents.length > 0) {
      phases.push({
        id: `phase-${category}`,
        category,
        agents,
      });
    }
  }

  return { phases };
}
