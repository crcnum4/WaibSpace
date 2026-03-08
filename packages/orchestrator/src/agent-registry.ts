import type { AgentCategory } from "@waibspace/types";
import type { Agent } from "@waibspace/agents";

export class AgentRegistry {
  private agents = new Map<string, Agent>();

  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  getByCategory(category: AgentCategory): Agent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.category === category,
    );
  }

  getById(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }
}
