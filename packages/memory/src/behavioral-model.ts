import type { MemoryStore } from "./memory-store";
import type { BehaviorAggregate } from "./behavioral-tracker";

/**
 * A learned preference derived from behavioral observations.
 */
export interface LearnedPreference {
  /** Domain this preference applies to (e.g. "email", "calendar"). */
  domain: string;
  /** Human-readable preference key (e.g. "sort-order", "peak-usage-hour"). */
  preferenceKey: string;
  /** The inferred preferred value. */
  value: string | number;
  /** Confidence score 0-1 based on observation strength. */
  confidence: number;
  /** Number of observations backing this preference. */
  observationCount: number;
}

export interface BehavioralModelOptions {
  /**
   * Minimum number of observations before a preference is considered learned.
   * Default: 5
   */
  minObservations?: number;
  /**
   * Minimum ratio the top choice must exceed the runner-up to be a "preference".
   * E.g. 1.5 means the top choice needs 1.5x the count of the second.
   * Default: 1.5
   */
  dominanceRatio?: number;
}

const BEHAVIOR_KEY_PREFIX = "behavior:";

/**
 * BehavioralModel reads aggregated observations from the MemoryStore
 * and derives learned user preferences using purely statistical heuristics.
 *
 * No LLM dependency — all computations are count-based and deterministic.
 *
 * This is the "detect patterns + store preferences" step in the pipeline.
 */
export class BehavioralModel {
  private readonly minObservations: number;
  private readonly dominanceRatio: number;

  constructor(
    private memoryStore: MemoryStore,
    options?: BehavioralModelOptions,
  ) {
    this.minObservations = options?.minObservations ?? 5;
    this.dominanceRatio = options?.dominanceRatio ?? 1.5;
  }

  /**
   * Compute all currently derivable preferences from stored observations.
   * Returns an array of learned preferences, each with a confidence score.
   */
  computePreferences(): LearnedPreference[] {
    const aggregates = this.loadAggregates();
    const preferences: LearnedPreference[] = [];

    for (const agg of aggregates) {
      // Derive detail preference (e.g. preferred sort order)
      const detailPref = this.deriveDetailPreference(agg);
      if (detailPref) preferences.push(detailPref);

      // Derive peak usage hour
      const peakHour = this.derivePeakHour(agg);
      if (peakHour) preferences.push(peakHour);

      // Derive preferred day of week
      const peakDay = this.derivePeakDay(agg);
      if (peakDay) preferences.push(peakDay);

      // Derive frequency preference (how often they use this feature)
      const freq = this.deriveFrequency(agg);
      if (freq) preferences.push(freq);
    }

    // Derive cross-domain preferences
    const domainPrefs = this.deriveDomainAffinities(aggregates);
    preferences.push(...domainPrefs);

    return preferences;
  }

  /**
   * Persist computed preferences into the memory store under the "profile"
   * category so other agents can read them through standard memory retrieval.
   */
  persistPreferences(): LearnedPreference[] {
    const preferences = this.computePreferences();

    for (const pref of preferences) {
      const key = `learned:${pref.domain}:${pref.preferenceKey}`;
      this.memoryStore.set("profile", key, pref, "behavioral-model");
    }

    if (preferences.length > 0) {
      console.log(
        `[behavioral-model] Persisted ${preferences.length} learned preferences`,
      );
    }

    return preferences;
  }

  // ---- Private: aggregate loading ----

  private loadAggregates(): BehaviorAggregate[] {
    const entries = this.memoryStore.getAll("interaction");
    const aggregates: BehaviorAggregate[] = [];
    for (const entry of entries) {
      if (entry.key.startsWith(BEHAVIOR_KEY_PREFIX)) {
        aggregates.push(entry.value as BehaviorAggregate);
      }
    }
    return aggregates;
  }

  // ---- Private: preference derivation ----

  /**
   * If the user consistently picks one detail value over others,
   * that's a preference (e.g. always sorting email by "date-desc").
   */
  private deriveDetailPreference(
    agg: BehaviorAggregate,
  ): LearnedPreference | null {
    const entries = Object.entries(agg.detailCounts);
    if (entries.length === 0) return null;

    const totalDetailObs = entries.reduce((sum, [, c]) => sum + c, 0);
    if (totalDetailObs < this.minObservations) return null;

    // Sort by count descending
    entries.sort((a, b) => b[1] - a[1]);
    const [topValue, topCount] = entries[0];
    const runnerUpCount = entries.length > 1 ? entries[1][1] : 0;

    // Check dominance
    if (runnerUpCount > 0 && topCount / runnerUpCount < this.dominanceRatio) {
      return null; // No clear preference
    }

    const confidence = Math.min(topCount / totalDetailObs, 1);

    return {
      domain: agg.domain,
      preferenceKey: `${agg.action}-preference`,
      value: topValue,
      confidence,
      observationCount: totalDetailObs,
    };
  }

  /**
   * Find the peak usage hour for a domain:action pair.
   */
  private derivePeakHour(agg: BehaviorAggregate): LearnedPreference | null {
    if (agg.totalCount < this.minObservations) return null;

    const max = Math.max(...agg.hourHistogram);
    if (max === 0) return null;

    const peakHour = agg.hourHistogram.indexOf(max);
    const confidence = max / agg.totalCount;

    // Only report if peak hour has meaningful concentration (>20% of all obs)
    if (confidence < 0.2) return null;

    return {
      domain: agg.domain,
      preferenceKey: `${agg.action}-peak-hour`,
      value: peakHour,
      confidence,
      observationCount: agg.totalCount,
    };
  }

  /**
   * Find the peak usage day for a domain:action pair.
   */
  private derivePeakDay(agg: BehaviorAggregate): LearnedPreference | null {
    if (agg.totalCount < this.minObservations) return null;

    const max = Math.max(...agg.dayHistogram);
    if (max === 0) return null;

    const peakDay = agg.dayHistogram.indexOf(max);
    const confidence = max / agg.totalCount;

    if (confidence < 0.2) return null;

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    return {
      domain: agg.domain,
      preferenceKey: `${agg.action}-peak-day`,
      value: dayNames[peakDay],
      confidence,
      observationCount: agg.totalCount,
    };
  }

  /**
   * Track frequency of use as a preference signal.
   * High-frequency actions are "favorite" features.
   */
  private deriveFrequency(agg: BehaviorAggregate): LearnedPreference | null {
    if (agg.totalCount < this.minObservations) return null;

    const durationMs = agg.lastSeen - agg.firstSeen;
    if (durationMs <= 0) return null;

    const durationDays = durationMs / (1000 * 60 * 60 * 24);
    if (durationDays < 1) return null;

    const perDay = agg.totalCount / durationDays;

    return {
      domain: agg.domain,
      preferenceKey: `${agg.action}-daily-frequency`,
      value: Math.round(perDay * 100) / 100,
      confidence: Math.min(agg.totalCount / 20, 1), // Grows with data
      observationCount: agg.totalCount,
    };
  }

  /**
   * Derive which domains the user engages with most overall.
   * Produces a "domain-affinity" preference with a ranked list.
   */
  private deriveDomainAffinities(
    aggregates: BehaviorAggregate[],
  ): LearnedPreference[] {
    const domainTotals = new Map<string, number>();
    for (const agg of aggregates) {
      domainTotals.set(
        agg.domain,
        (domainTotals.get(agg.domain) ?? 0) + agg.totalCount,
      );
    }

    const sorted = Array.from(domainTotals.entries()).sort(
      (a, b) => b[1] - a[1],
    );

    if (sorted.length === 0) return [];

    const totalObs = sorted.reduce((sum, [, c]) => sum + c, 0);
    if (totalObs < this.minObservations) return [];

    // Return top domain as a preference
    const [topDomain, topCount] = sorted[0];

    return [
      {
        domain: "global",
        preferenceKey: "most-used-domain",
        value: topDomain,
        confidence: topCount / totalObs,
        observationCount: totalObs,
      },
    ];
  }
}
