import type { AgentOutput, SurfaceSpec, LayoutHints } from "@waibspace/types";
import type {
  ComposedLayout,
  LayoutDirective,
} from "@waibspace/ui-renderer-contract";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

const MAX_VISIBLE_SURFACES = 4;

/**
 * Extract SurfaceSpec objects from a list of agent outputs.
 *
 * Checks each output for:
 * - Direct SurfaceSpec (has surfaceType and surfaceId)
 * - Nested under a `surface` or `spec` property
 */
export function extractSurfaces(outputs: AgentOutput[]): SurfaceSpec[] {
  const surfaces: SurfaceSpec[] = [];

  for (const out of outputs) {
    const value = out.output as Record<string, unknown> | undefined;
    if (!value || typeof value !== "object") continue;

    if (isSurfaceSpec(value)) {
      surfaces.push(value as unknown as SurfaceSpec);
      continue;
    }

    // Check nested `surface`, `spec`, or `surfaceSpec` fields
    for (const key of ["surface", "spec", "surfaceSpec"] as const) {
      const nested = value[key];
      if (nested && typeof nested === "object" && isSurfaceSpec(nested as Record<string, unknown>)) {
        surfaces.push(nested as unknown as SurfaceSpec);
      }
    }
  }

  return surfaces;
}

function isSurfaceSpec(obj: Record<string, unknown>): boolean {
  return typeof obj["surfaceType"] === "string" && typeof obj["surfaceId"] === "string";
}

/**
 * Deterministic layout composer agent.
 *
 * Collects SurfaceSpec outputs from prior UI agents, resolves position
 * conflicts, generates LayoutDirectives, and returns a ComposedLayout.
 */
export class LayoutComposerAgent extends BaseAgent {
  constructor() {
    super({
      id: "layout-composer",
      name: "layout-composer",
      type: "ui.layout-composer",
      category: "ui",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    // 1. Collect all SurfaceSpec objects from priorOutputs
    const surfaces = extractSurfaces(input.priorOutputs);

    this.log("Collected surfaces", { count: surfaces.length });

    // 2. Sort by priority (highest first)
    surfaces.sort((a, b) => b.priority - a.priority);

    // 3. Resolve position conflicts
    const resolved = this.resolvePositions(surfaces);

    // 4. Generate LayoutDirectives (max 4 visible)
    const layout = this.buildDirectives(resolved);

    const endMs = Date.now();

    // 5. Build ComposedLayout
    const composed: ComposedLayout = {
      surfaces: resolved,
      layout,
      timestamp: Date.now(),
      traceId: context.traceId,
    };

    return {
      ...this.createOutput(composed, 1.0, {
        dataState: "transformed",
        transformations: ["layout-composition"],
        timestamp: startMs,
      }),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  /**
   * Resolve position conflicts among surfaces.
   *
   * Rules:
   * - Only one surface can be "primary"
   * - "overlay" surfaces (e.g. approvals) always win their position
   * - Extra primary-positioned surfaces get demoted to "secondary"
   */
  private resolvePositions(surfaces: SurfaceSpec[]): SurfaceSpec[] {
    let hasPrimary = false;

    return surfaces.map((surface) => {
      const position = surface.layoutHints.position ?? "secondary";

      // Overlays always keep their position
      if (position === "overlay") {
        return surface;
      }

      if (position === "primary") {
        if (!hasPrimary) {
          hasPrimary = true;
          return surface;
        }
        // Demote duplicate primaries to secondary
        return {
          ...surface,
          layoutHints: { ...surface.layoutHints, position: "secondary" as const },
        };
      }

      return surface;
    });
  }

  /**
   * Map resolved surfaces to LayoutDirectives.
   *
   * - Assigns sequential position numbers (0 = first/top)
   * - Dashboard mode (2 surfaces): primary gets "two-thirds", secondary gets "third"
   * - Single surface: primary gets "full"
   * - 3+ surfaces: secondary surfaces default to "half"
   * - Prominence defaults from layoutHints or "standard"
   * - Max 4 visible surfaces
   */
  private buildDirectives(surfaces: SurfaceSpec[]): LayoutDirective[] {
    const visible = surfaces.slice(0, MAX_VISIBLE_SURFACES);
    const isDashboard = visible.length === 2;

    return visible.map((surface, idx) => {
      const hints: LayoutHints = surface.layoutHints;
      const position = hints.position ?? "secondary";

      let defaultWidth: string;
      if (isDashboard) {
        // Dashboard layout: primary (2/3) + secondary (1/3)
        defaultWidth = position === "primary" ? "two-thirds" : "third";
      } else {
        defaultWidth = position === "primary" ? "full" : "half";
      }

      return {
        surfaceId: surface.surfaceId,
        position: idx,
        width: hints.width ?? defaultWidth,
        prominence: hints.prominence ?? "standard",
      };
    });
  }
}
