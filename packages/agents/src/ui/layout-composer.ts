import type { AgentOutput, SurfaceSpec, LayoutHints } from "@waibspace/types";
import type {
  ComposedLayout,
  LayoutDirective,
} from "@waibspace/ui-renderer-contract";
import type { EngagementTracker, EngagementScore } from "@waibspace/memory";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

const MAX_VISIBLE_SURFACES = 4;

/**
 * Priority boost applied per engagement score point (0-1 range).
 * A fully engaged surface (score=1) gets up to this many extra priority points.
 */
const ENGAGEMENT_PRIORITY_BOOST = 30;

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

    // 2. Retrieve engagement data if available
    const engagementTracker = context.config?.engagementTracker as
      | EngagementTracker
      | undefined;
    const engagementScores = engagementTracker?.getScores() ?? [];
    const scoreMap = new Map<string, EngagementScore>();
    for (const score of engagementScores) {
      scoreMap.set(score.surfaceType, score);
    }

    if (engagementScores.length > 0) {
      this.log("Engagement data available", {
        trackedTypes: engagementScores.length,
        topType: engagementScores[0]?.surfaceType,
        topScore: engagementScores[0]?.score.toFixed(3),
      });
    }

    // 3. Sort by priority, boosted by engagement score
    surfaces.sort((a, b) => {
      const boostA = (scoreMap.get(a.surfaceType)?.score ?? 0) * ENGAGEMENT_PRIORITY_BOOST;
      const boostB = (scoreMap.get(b.surfaceType)?.score ?? 0) * ENGAGEMENT_PRIORITY_BOOST;
      return (b.priority + boostB) - (a.priority + boostA);
    });

    // 4. Resolve position conflicts
    const resolved = this.resolvePositions(surfaces);

    // 5. Apply engagement-based prominence adjustments
    const prominenceMap = engagementTracker?.getProminenceMap();
    const adjusted = prominenceMap
      ? this.applyEngagementProminence(resolved, prominenceMap)
      : resolved;

    // 6. Generate LayoutDirectives (max 4 visible)
    const layout = this.buildDirectives(adjusted);

    const endMs = Date.now();

    // 7. Build ComposedLayout
    const composed: ComposedLayout = {
      surfaces: adjusted,
      layout,
      timestamp: Date.now(),
      traceId: context.traceId,
    };

    return {
      ...this.createOutput(composed, 1.0, {
        dataState: "transformed",
        transformations: ["layout-composition", ...(prominenceMap ? ["engagement-adaptive"] : [])],
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
   * Apply engagement-driven prominence to surfaces.
   *
   * If a surface's layoutHints don't already specify a prominence, the
   * engagement tracker's prominence map overrides the default. This means
   * highly-used surfaces get "hero" prominence and rarely-used ones get
   * "compact", without overriding explicit agent hints.
   */
  private applyEngagementProminence(
    surfaces: SurfaceSpec[],
    prominenceMap: Map<string, "hero" | "standard" | "compact">,
  ): SurfaceSpec[] {
    return surfaces.map((surface) => {
      // Only override if the agent didn't explicitly set prominence
      if (surface.layoutHints.prominence) return surface;

      const engagementProminence = prominenceMap.get(surface.surfaceType);
      if (!engagementProminence) return surface;

      return {
        ...surface,
        layoutHints: {
          ...surface.layoutHints,
          prominence: engagementProminence,
        },
      };
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
