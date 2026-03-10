import type { AgentOutput, SurfaceSpec, LayoutHints } from "@waibspace/types";
import type {
  ComposedLayout,
  LayoutDirective,
} from "@waibspace/ui-renderer-contract";
import type { EngagementTracker, EngagementScore } from "@waibspace/memory";
import { SurfaceFactory } from "@waibspace/surfaces";
import type { BriefingCardSpec, BriefingSurfaceData } from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { TriageOutput, TriagedItem } from "../triage/types";

const MAX_VISIBLE_SURFACES = 4;

/**
 * Priority boost applied per engagement score point (0-1 range).
 * A fully engaged surface (score=1) gets up to this many extra priority points.
 */
const ENGAGEMENT_PRIORITY_BOOST = 30;

/**
 * Return a time-of-day greeting string.
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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

/**
 * Extract TriageOutput from prior agent outputs, if any triage agent ran.
 */
function extractTriageOutput(outputs: AgentOutput[]): TriageOutput | null {
  for (const out of outputs) {
    const value = out.output as Record<string, unknown> | undefined;
    if (!value || typeof value !== "object") continue;

    // TriageOutput has items[], stats, classifierId, connectorId
    if (
      Array.isArray(value["items"]) &&
      value["stats"] &&
      typeof value["classifierId"] === "string" &&
      typeof value["connectorId"] === "string"
    ) {
      return value as unknown as TriageOutput;
    }

    // Check nested `triageOutput` or `triage` fields
    for (const key of ["triageOutput", "triage"] as const) {
      const nested = value[key] as Record<string, unknown> | undefined;
      if (
        nested &&
        typeof nested === "object" &&
        Array.isArray(nested["items"]) &&
        nested["stats"] &&
        typeof nested["classifierId"] === "string"
      ) {
        return nested as unknown as TriageOutput;
      }
    }
  }
  return null;
}

function isSurfaceSpec(obj: Record<string, unknown>): boolean {
  return typeof obj["surfaceType"] === "string" && typeof obj["surfaceId"] === "string";
}

/**
 * Deterministic layout composer agent.
 *
 * Collects SurfaceSpec outputs from prior UI agents, resolves position
 * conflicts, generates LayoutDirectives, and returns a ComposedLayout.
 *
 * When triage data is available, transforms the layout into a briefing
 * with intelligent cards instead of a raw surface grid.
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

    // 2. Check for triage data in priorOutputs
    const triageOutput = extractTriageOutput(input.priorOutputs);

    if (triageOutput) {
      this.log("Triage data found, composing briefing", {
        totalItems: triageOutput.stats.total,
        highUrgency: triageOutput.stats.byUrgency.high ?? 0,
        autoActions: triageOutput.autoActions?.length ?? 0,
      });
      return this.composeBriefingLayout(triageOutput, surfaces, context, startMs);
    }

    // 3. Fallback: grid-based layout (existing behavior)
    this.log("No triage data, using grid layout");
    return this.composeGridLayout(surfaces, context, startMs);
  }

  /**
   * Compose a briefing-oriented layout from triage data.
   *
   * Transforms triaged items into briefing cards:
   * - Main briefing card with greeting and summary stats
   * - Action cards for high-urgency items needing attention
   * - Insight card summarizing auto-handled items
   * - Status card for connector health
   */
  private composeBriefingLayout(
    triageOutput: TriageOutput,
    surfaces: SurfaceSpec[],
    context: AgentContext,
    startMs: number,
  ): AgentOutput {
    const cards: BriefingCardSpec[] = [];

    // --- Main Briefing Card ---
    const { stats, items } = triageOutput;
    const highCount = stats.byUrgency.high ?? 0;
    const mediumCount = stats.byUrgency.medium ?? 0;
    const lowCount = stats.byUrgency.low ?? 0;
    const autoActionCount = triageOutput.autoActions?.length ?? 0;

    cards.push({
      cardType: "briefing-card",
      priority: 100,
      data: {
        title: getGreeting(),
        summary: `${stats.total} items triaged from ${triageOutput.connectorId}`,
        urgentCount: highCount,
        mediumCount,
        lowCount,
        handledCount: autoActionCount,
      },
    });

    // --- Action Cards for high-urgency items ---
    const urgentItems = items.filter(
      (item: TriagedItem) => item.triage.urgency === "high",
    );

    for (const item of urgentItems) {
      const raw = item.raw as Record<string, unknown>;
      cards.push({
        cardType: "action-card",
        priority: 90,
        data: {
          itemId: item.triage.itemId,
          from: raw["from"] ?? raw["sender"] ?? "Unknown",
          subject: raw["subject"] ?? raw["title"] ?? "No subject",
          snippet: raw["snippet"] ?? raw["body"] ?? "",
          category: item.triage.category,
          reasoning: item.triage.reasoning,
          suggestedAction: item.triage.suggestedAction,
          confidence: item.triage.confidence,
          actions: ["approve", "edit", "dismiss"],
        },
      });
    }

    // --- Insight Card for auto-actions ---
    if (autoActionCount > 0 || (triageOutput.memoryCandidates?.length ?? 0) > 0) {
      const autoActions = triageOutput.autoActions ?? [];
      const memoryCandidates = triageOutput.memoryCandidates ?? [];

      const actionSummary: Record<string, number> = {};
      for (const action of autoActions) {
        actionSummary[action.type] = (actionSummary[action.type] ?? 0) + 1;
      }

      cards.push({
        cardType: "insight-card",
        priority: 60,
        data: {
          title: "Auto-handled",
          autoActionCount,
          actionBreakdown: actionSummary,
          memoryCandidateCount: memoryCandidates.length,
          memorySummaries: memoryCandidates.map((mc) => ({
            domain: mc.domain,
            summary: mc.summary,
          })),
        },
      });
    }

    // --- Status Card ---
    cards.push({
      cardType: "status-card",
      priority: 40,
      data: {
        connectorId: triageOutput.connectorId,
        classifierId: triageOutput.classifierId,
        itemsProcessed: stats.total,
        categoryBreakdown: stats.byCategory,
        timestamp: Date.now(),
      },
    });

    // Sort cards by priority descending
    cards.sort((a, b) => b.priority - a.priority);

    // Build the briefing surface
    const briefingData: BriefingSurfaceData = {
      cards,
      generatedAt: Date.now(),
      mode: "initial",
    };

    const briefingSurface = SurfaceFactory.briefing(briefingData, {
      sourceType: "system",
      sourceId: "layout-composer",
      trustLevel: "trusted",
      timestamp: Date.now(),
      freshness: "realtime",
      dataState: "transformed",
      transformations: ["triage-to-briefing"],
    });

    // Keep overlay surfaces (e.g., approvals) alongside the briefing
    const overlays = surfaces.filter(
      (s) => s.layoutHints.position === "overlay",
    );

    const allSurfaces = [briefingSurface, ...overlays];
    const layout = this.buildDirectives(allSurfaces);

    const endMs = Date.now();

    const composed: ComposedLayout = {
      surfaces: allSurfaces,
      layout,
      timestamp: Date.now(),
      traceId: context.traceId,
    };

    return {
      ...this.createOutput(composed, 1.0, {
        dataState: "transformed",
        transformations: ["triage-to-briefing", "layout-composition"],
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
   * Compose the original grid-based layout (fallback when no triage data).
   */
  private composeGridLayout(
    surfaces: SurfaceSpec[],
    context: AgentContext,
    startMs: number,
  ): AgentOutput {
    // Retrieve engagement data if available
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

    // Sort by priority, boosted by engagement score
    surfaces.sort((a, b) => {
      const boostA = (scoreMap.get(a.surfaceType)?.score ?? 0) * ENGAGEMENT_PRIORITY_BOOST;
      const boostB = (scoreMap.get(b.surfaceType)?.score ?? 0) * ENGAGEMENT_PRIORITY_BOOST;
      return (b.priority + boostB) - (a.priority + boostA);
    });

    // Resolve position conflicts
    const resolved = this.resolvePositions(surfaces);

    // Apply engagement-based prominence adjustments
    const prominenceMap = engagementTracker?.getProminenceMap();
    const adjusted = prominenceMap
      ? this.applyEngagementProminence(resolved, prominenceMap)
      : resolved;

    // Generate LayoutDirectives (max 4 visible)
    const layout = this.buildDirectives(adjusted);

    const endMs = Date.now();

    // Build ComposedLayout
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
