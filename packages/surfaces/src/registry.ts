import type { SurfaceSpec } from "@waibspace/types";

interface RegistryEntry {
  type: string;
  requiredFields: string[];
}

export class SurfaceTypeRegistry {
  private entries: Map<string, RegistryEntry> = new Map();

  register(type: string, requiredFields: string[]): void {
    this.entries.set(type, { type, requiredFields });
  }

  isValid(spec: SurfaceSpec): boolean {
    const entry = this.entries.get(spec.surfaceType);
    if (!entry) {
      return false;
    }

    const data = spec.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object") {
      return entry.requiredFields.length === 0;
    }

    return entry.requiredFields.every((field) => field in data);
  }

  getRegistered(): string[] {
    return Array.from(this.entries.keys());
  }
}

export function createDefaultRegistry(): SurfaceTypeRegistry {
  const registry = new SurfaceTypeRegistry();
  registry.register("inbox", ["emails", "totalCount", "unreadCount"]);
  registry.register("calendar", ["events", "freeSlots", "dateRange"]);
  registry.register("discovery", ["query", "results", "sources"]);
  registry.register("approval", [
    "approvalId",
    "actionDescription",
    "riskClass",
    "context",
    "consequences",
  ]);
  registry.register("connection-guide", ["step", "message", "availableServices"]);
  registry.register("generic", []);
  return registry;
}
