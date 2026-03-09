import type { MemoryStore } from "./memory-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw record of a single user interaction with a surface.
 */
export interface SurfaceInteraction {
  surfaceType: string;
  surfaceId: string;
  interaction: string;
  timestamp: number;
}

/**
 * Aggregated engagement metrics for a surface type.
 *
 * Stored in memory under category "engagement", keyed by surfaceType.
 */
export interface EngagementMetrics {
  surfaceType: string;
  /** Total number of interactions across all time. */
  totalInteractions: number;
  /** Number of interactions in the recent window (last 7 days). */
  recentInteractions: number;
  /** Timestamp of the most recent interaction. */
  lastInteractedAt: number;
  /** Interaction count broken down by interaction type (click, expand, etc.). */
  interactionsByType: Record<string, number>;
}

/**
 * Scored surface type, combining recency and frequency into a single rank.
 */
export interface EngagementScore {
  surfaceType: string;
  /** Normalized score between 0 and 1. Higher = more engaged. */
  score: number;
  metrics: EngagementMetrics;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Interactions within this window are weighted more heavily. */
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Weights for the engagement scoring formula.
 * - recentFrequency: how often the user interacted recently (0-1)
 * - recency: how recently the last interaction occurred (0-1)
 * - totalFrequency: lifetime interaction share (0-1)
 */
const WEIGHTS = {
  recentFrequency: 0.5,
  recency: 0.3,
  totalFrequency: 0.2,
} as const;

/** Half-life for recency decay (3 days). */
const RECENCY_HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// EngagementTracker
// ---------------------------------------------------------------------------

/**
 * Heuristic-based engagement tracker.
 *
 * Records surface interactions in the MemoryStore under the "engagement"
 * category and produces ranked scores that the LayoutComposerAgent can use
 * to influence surface ordering and prominence.
 */
export class EngagementTracker {
  constructor(private readonly memoryStore: MemoryStore) {}

  // -----------------------------------------------------------------------
  // Recording
  // -----------------------------------------------------------------------

  /**
   * Record a user interaction with a surface.
   *
   * Updates the aggregated EngagementMetrics stored in memory.
   */
  recordInteraction(interaction: SurfaceInteraction): void {
    const { surfaceType, interaction: interactionType, timestamp } = interaction;
    const key = `surface:${surfaceType}`;

    const existing = this.memoryStore.get("engagement", key);
    const now = timestamp || Date.now();

    let metrics: EngagementMetrics;

    if (existing) {
      metrics = existing.value as EngagementMetrics;
      metrics.totalInteractions += 1;
      metrics.lastInteractedAt = Math.max(metrics.lastInteractedAt, now);
      metrics.interactionsByType[interactionType] =
        (metrics.interactionsByType[interactionType] ?? 0) + 1;

      // Recompute recent interactions from a simple increment.
      // The full recomputation happens at scoring time; here we optimistically
      // increment so the stored value stays roughly correct.
      metrics.recentInteractions += 1;
    } else {
      metrics = {
        surfaceType,
        totalInteractions: 1,
        recentInteractions: 1,
        lastInteractedAt: now,
        interactionsByType: { [interactionType]: 1 },
      };
    }

    this.memoryStore.set("engagement", key, metrics, "engagement-tracker");
  }

  // -----------------------------------------------------------------------
  // Scoring
  // -----------------------------------------------------------------------

  /**
   * Compute engagement scores for all tracked surface types.
   *
   * Returns an array sorted by score descending (most engaged first).
   */
  getScores(): EngagementScore[] {
    const entries = this.memoryStore.getAll("engagement");
    if (entries.length === 0) return [];

    const now = Date.now();
    const recentCutoff = now - RECENT_WINDOW_MS;

    // Refresh recentInteractions based on the stored lastInteractedAt.
    // Since we don't store individual event timestamps, we approximate:
    // if lastInteractedAt is within the window, recentInteractions stands;
    // otherwise decay it toward zero.
    const metricsList: EngagementMetrics[] = entries
      .filter((e) => e.key.startsWith("surface:"))
      .map((e) => {
        const m = e.value as EngagementMetrics;
        if (m.lastInteractedAt < recentCutoff) {
          // All recent activity is stale — zero out recent count
          m.recentInteractions = 0;
        }
        return m;
      });

    if (metricsList.length === 0) return [];

    // Compute normalizers
    const maxRecent = Math.max(...metricsList.map((m) => m.recentInteractions), 1);
    const maxTotal = Math.max(...metricsList.map((m) => m.totalInteractions), 1);

    const scores: EngagementScore[] = metricsList.map((metrics) => {
      // Recent frequency: normalized 0-1
      const recentFrequency = metrics.recentInteractions / maxRecent;

      // Recency: exponential decay from lastInteractedAt
      const ageSinceLastMs = now - metrics.lastInteractedAt;
      const recency = Math.pow(0.5, ageSinceLastMs / RECENCY_HALF_LIFE_MS);

      // Total frequency: normalized 0-1
      const totalFrequency = metrics.totalInteractions / maxTotal;

      const score =
        WEIGHTS.recentFrequency * recentFrequency +
        WEIGHTS.recency * recency +
        WEIGHTS.totalFrequency * totalFrequency;

      return { surfaceType: metrics.surfaceType, score, metrics };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores;
  }

  /**
   * Get the engagement score for a specific surface type, or undefined
   * if no interactions have been recorded for it.
   */
  getScoreFor(surfaceType: string): EngagementScore | undefined {
    return this.getScores().find((s) => s.surfaceType === surfaceType);
  }

  /**
   * Map engagement scores to prominence hints.
   *
   * - Top-scored surface -> "hero"
   * - Above median -> "standard"
   * - Below median -> "compact"
   * - No data -> undefined (use defaults)
   */
  getProminenceMap(): Map<string, "hero" | "standard" | "compact"> {
    const scores = this.getScores();
    if (scores.length === 0) return new Map();

    const map = new Map<string, "hero" | "standard" | "compact">();
    const median = scores[Math.floor(scores.length / 2)].score;

    for (let i = 0; i < scores.length; i++) {
      const { surfaceType, score } = scores[i];
      if (i === 0 && score > 0) {
        map.set(surfaceType, "hero");
      } else if (score >= median) {
        map.set(surfaceType, "standard");
      } else {
        map.set(surfaceType, "compact");
      }
    }

    return map;
  }
}
