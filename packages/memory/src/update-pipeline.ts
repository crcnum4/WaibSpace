import type { WaibEvent } from "@waibspace/types";
import type { MemoryStore } from "./memory-store";
import type { EventBus } from "@waibspace/event-bus";

const SYSTEM_MEMORY_LIMIT = 500;

export class MemoryUpdatePipeline {
  constructor(
    private memoryStore: MemoryStore,
    private eventBus: EventBus,
  ) {}

  /**
   * Subscribe to orchestration and interaction events.
   */
  start(): void {
    // Listen for surface.composed events (end of a cycle)
    this.eventBus.on("surface.composed", (event) => {
      this.processOrchestrationResult(event);
    });

    // Listen for interaction semantics that need correction storage
    this.eventBus.on("user.interaction.*", (event) => {
      this.processInteraction(event);
    });
  }

  /**
   * Process an orchestration cycle result by logging agent decisions
   * to system memory and pruning old entries if over the limit.
   */
  private processOrchestrationResult(event: WaibEvent): void {
    const { traceId, timestamp, payload } = event;

    // Store the orchestration result as a system memory entry
    const key = `orchestration:${traceId}`;
    this.memoryStore.set("system", key, {
      traceId,
      timestamp,
      summary: payload,
    }, "orchestration-pipeline");

    // Prune old system memory entries if over the limit
    const systemEntries = this.memoryStore.getAll("system");
    if (systemEntries.length > SYSTEM_MEMORY_LIMIT) {
      // Sort oldest first
      const sorted = systemEntries.sort((a, b) => a.updatedAt - b.updatedAt);
      const toRemove = sorted.slice(0, systemEntries.length - SYSTEM_MEMORY_LIMIT);
      for (const entry of toRemove) {
        this.memoryStore.delete(entry.id);
      }
    }
  }

  /**
   * Process a user interaction event. If it includes a correction
   * (user overriding a mapping), store the corrected mapping in
   * interaction memory. Also track interaction patterns.
   */
  private processInteraction(event: WaibEvent): void {
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload) return;

    const surfaceType = payload.surfaceType as string | undefined;
    const interaction = payload.interaction as string | undefined;
    const semanticMeaning = payload.semanticMeaning as string | undefined;

    // If the interaction includes a correction, store the mapping
    if (surfaceType && interaction && semanticMeaning) {
      this.setInteractionMapping(surfaceType, interaction, semanticMeaning);
    }

    // Track interaction patterns
    if (surfaceType && interaction) {
      const patternKey = `pattern:${surfaceType}:${interaction}`;
      const existing = this.memoryStore.get("interaction", patternKey);
      const count = existing ? (existing.value as number) + 1 : 1;
      this.memoryStore.set("interaction", patternKey, count, "interaction-tracker");
    }
  }

  /**
   * Store a user preference explicitly.
   */
  setPreference(key: string, value: unknown, source: string): void {
    this.memoryStore.set("profile", key, value, source);
  }

  /**
   * Store an interaction mapping (e.g. from a user correction).
   */
  setInteractionMapping(surfaceType: string, interaction: string, meaning: string): void {
    this.memoryStore.set("interaction", `${surfaceType}:${interaction}`, meaning, "user-correction");
  }
}
