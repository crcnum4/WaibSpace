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
 * Agents within the same category that must run sequentially
 * because they depend on each other's outputs.
 *
 * Each entry defines a category and ordered groups of agent IDs.
 * Agents in the same group run in parallel; groups run sequentially.
 */
interface AgentOrdering {
  category: AgentCategory;
  groups: string[][];
}

/**
 * For event types that require sequential execution within a category,
 * define the agent ordering explicitly.
 */
const AGENT_ORDERINGS: Record<string, AgentOrdering[]> = {
  "user.intent.url_received": [
    {
      category: "context",
      groups: [
        ["context.planner"],
        ["context.connector-selection"],
        ["context.data-retrieval"],
      ],
    },
    {
      category: "ui",
      groups: [
        ["ui.discovery-surface"],
        ["layout-composer"],
      ],
    },
  ],
  "system.poll": [
    {
      category: "context",
      groups: [
        ["context.connector-selection"],
        ["context.data-retrieval"],
      ],
    },
    {
      category: "triage",
      groups: [
        ["triage.data-classifier"],
      ],
    },
    {
      category: "ui",
      groups: [
        ["ui.inbox-surface", "ui.calendar-surface", "ui.generic-data-surface"],
        ["layout-composer"],
      ],
    },
  ],
  "user.message.received": [
    {
      category: "context",
      groups: [
        ["context.planner"],
        ["context.connector-selection"],
        ["context.data-retrieval"],
      ],
    },
    {
      category: "triage",
      groups: [
        ["triage.data-classifier"],
      ],
    },
    {
      category: "ui",
      groups: [
        // All surface agents run in parallel, then layout composer
        ["ui.inbox-surface", "ui.calendar-surface", "ui.discovery-surface", "ui.search-surface", "ui.connection-surface", "ui.generic-data-surface"],
        ["layout-composer"],
      ],
    },
  ],
};

/**
 * Define the pipeline order based on event type.
 */
function getPipelineForEvent(eventType: string): AgentCategory[] {
  if (
    eventType === "user.message.received" ||
    eventType === "user.intent.url_received"
  ) {
    return ["perception", "reasoning", "context", "triage", "ui", "safety"];
  }

  if (eventType.startsWith("user.interaction.")) {
    return ["perception", "reasoning", "context", "triage", "ui", "safety"];
  }

  if (eventType === "policy.approval.response") {
    return ["execution"];
  }

  // system.poll events already know the intent (check for updates) — skip
  // perception and reasoning, go straight to context + ui + safety.
  if (eventType === "system.poll") {
    return ["context", "triage", "ui", "safety"];
  }

  // Default pipeline
  return ["perception", "reasoning", "context", "triage", "ui", "safety"];
}

/**
 * Build an execution plan based on event type and registered agents.
 *
 * For categories that have explicit agent orderings, the category is split
 * into sequential sub-phases. Otherwise, all agents in the category run
 * in a single parallel phase.
 *
 * Phases with no agents are omitted.
 */
export function buildExecutionPlan(
  eventType: string,
  registry: AgentRegistry,
): ExecutionPlan {
  const categories = getPipelineForEvent(eventType);
  // Look up exact match first, then fall back to pattern-based orderings
  // (e.g. user.interaction.* events reuse the user.message.received ordering)
  const orderings = AGENT_ORDERINGS[eventType]
    ?? (eventType.startsWith("user.interaction.") ? AGENT_ORDERINGS["user.message.received"] : undefined);

  const phases: ExecutionPhase[] = [];

  for (const category of categories) {
    const ordering = orderings?.find((o) => o.category === category);

    if (ordering) {
      // Split this category into sequential sub-phases
      let subIndex = 0;
      for (const group of ordering.groups) {
        const agents = group
          .map((id) => registry.getById(id))
          .filter((a): a is Agent => a !== undefined);

        if (agents.length > 0) {
          phases.push({
            id: `phase-${category}-${subIndex}`,
            category,
            agents,
          });
          subIndex++;
        }
      }

      // Also include any agents in this category NOT mentioned in the ordering
      const mentionedIds = new Set(ordering.groups.flat());
      const remainingAgents = registry
        .getByCategory(category)
        .filter((a) => !mentionedIds.has(a.id));

      if (remainingAgents.length > 0) {
        phases.push({
          id: `phase-${category}-remaining`,
          category,
          agents: remainingAgents,
        });
      }
    } else {
      // Default: all agents in the category run in parallel
      const agents = registry.getByCategory(category);
      if (agents.length > 0) {
        phases.push({
          id: `phase-${category}`,
          category,
          agents,
        });
      }
    }
  }

  return { phases };
}
