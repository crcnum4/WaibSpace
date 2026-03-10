/**
 * Memory Compaction Pipeline — promotes insights between memory tiers.
 *
 * Short-term → Mid-term: Called after a pipeline run completes.
 *   Summarizes ephemeral task data into domain-scoped mid-term insights.
 *
 * Mid-term → Long-term: Called periodically (e.g., daily).
 *   Applies relevance decay, prunes low-relevance entries, and
 *   demotes them to keyword-indexed long-term storage.
 */

import type { ShortTermMemoryManager } from "./short-term-memory";
import type { MidTermMemory, MidTermEntry } from "./midterm-memory";
import type { LongTermMemory } from "./longterm-memory";

/** Chat message shape (mirrors @waibspace/model-provider Message). */
export interface CompactorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompactionInsight {
  domain: string;
  key: string;
  summary: string;
}

export interface LongTermExtract {
  keywords: string[];
  blurb: string;
  domain: string;
}

/**
 * Callable that performs a structured LLM completion.
 * Accepts system prompt, messages, and a JSON schema, returns the parsed result.
 * This allows the compactor to work with any model provider configuration
 * without needing to know about roles or routing.
 */
export type StructuredCompletionFn = <T>(
  system: string,
  messages: CompactorMessage[],
  responseSchema: Record<string, unknown>,
) => Promise<T>;

export interface CompactionStats {
  insightsPromoted: number;
  entriesDecayed: number;
  entriesPruned: number;
  entriesDemotedToLongTerm: number;
}

const SHORT_TO_MID_SYSTEM = `You are a memory compaction system. Extract domain-scoped insights worth remembering from this task data. Each insight should have:
- domain: a scoped category (e.g., "email:personal", "github:dev", "calendar", "global")
- key: a short descriptive identifier (e.g., "preferred-meeting-time", "boss-communication-style")
- summary: a concise one-sentence summary of the insight

Only extract genuinely useful insights that would help in future tasks. Ignore transient data.`;

const SHORT_TO_MID_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          domain: { type: "string" },
          key: { type: "string" },
          summary: { type: "string" },
        },
        required: ["domain", "key", "summary"],
      },
    },
  },
  required: ["insights"],
};

const MID_TO_LONG_SYSTEM = `You are a memory archival system. Given a list of mid-term memory entries that are being demoted to long-term storage, extract keyword-indexed entries suitable for full-text search retrieval. For each entry produce:
- keywords: an array of search terms that would help retrieve this knowledge later
- blurb: a concise summary suitable for background context injection
- domain: the domain scope (preserve from the original entry)`;

const MID_TO_LONG_SCHEMA = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          keywords: { type: "array", items: { type: "string" } },
          blurb: { type: "string" },
          domain: { type: "string" },
        },
        required: ["keywords", "blurb", "domain"],
      },
    },
  },
  required: ["entries"],
};

export class MemoryCompactor {
  constructor(
    private shortTerm: ShortTermMemoryManager,
    private midTerm: MidTermMemory,
    private longTerm: LongTermMemory,
  ) {}

  /**
   * Compact short-term → mid-term for a completed task.
   * Called after a pipeline run completes.
   *
   * If completionFn is available, uses LLM to summarize task data into insights.
   * Otherwise, promotes raw key-value pairs as-is with domain "global".
   */
  async compactShortTerm(
    traceId: string,
    completionFn?: StructuredCompletionFn,
  ): Promise<{ insightsPromoted: number }> {
    const store = this.shortTerm.create(traceId);
    const entries = store.getAll();

    // Nothing to compact
    if (Object.keys(entries).length === 0) {
      this.shortTerm.destroy(traceId);
      return { insightsPromoted: 0 };
    }

    let insights: CompactionInsight[];

    if (completionFn) {
      // Use LLM to extract structured insights
      const result = await completionFn<{ insights: CompactionInsight[] }>(
        SHORT_TO_MID_SYSTEM,
        [{ role: "user", content: JSON.stringify(entries) }],
        SHORT_TO_MID_SCHEMA,
      );
      insights = result.insights;
    } else {
      // Fallback: promote each key-value pair as a "global" insight
      insights = Object.entries(entries).map(([key, value]) => ({
        domain: "global",
        key,
        summary: typeof value === "string" ? value : JSON.stringify(value),
      }));
    }

    // Store each insight in mid-term memory (handles upsert/reinforcement)
    for (const insight of insights) {
      this.midTerm.store(insight.domain, insight.key, insight.summary);
    }

    this.shortTerm.destroy(traceId);
    return { insightsPromoted: insights.length };
  }

  /**
   * Run mid-term decay and promote stale entries to long-term.
   * Called periodically (e.g., daily cron).
   *
   * If completionFn is available, uses LLM to extract keywords and blurbs.
   * Otherwise, derives keywords from the entry's key and uses the summary as-is.
   */
  async compactMidTerm(
    completionFn?: StructuredCompletionFn,
  ): Promise<{
    entriesDecayed: number;
    entriesPruned: number;
    entriesDemotedToLongTerm: number;
  }> {
    // Step 1: Apply time-based relevance decay
    const { decayed: entriesDecayed } = this.midTerm.applyDecay();

    // Step 2: Prune entries below relevance threshold
    const pruned = this.midTerm.prune(0.1);
    const entriesPruned = pruned.length;

    if (pruned.length === 0) {
      return { entriesDecayed, entriesPruned, entriesDemotedToLongTerm: 0 };
    }

    // Step 3: Demote pruned entries to long-term memory
    let longTermExtracts: LongTermExtract[];

    if (completionFn) {
      // Use LLM to extract keyword-indexed entries
      const prunedForLlm = pruned.map((e) => ({
        domain: e.domain,
        key: e.key,
        summary: e.summary,
      }));

      const result = await completionFn<{ entries: LongTermExtract[] }>(
        MID_TO_LONG_SYSTEM,
        [{ role: "user", content: JSON.stringify(prunedForLlm) }],
        MID_TO_LONG_SCHEMA,
      );
      longTermExtracts = result.entries;
    } else {
      // Fallback: derive keywords from key, use summary as blurb
      longTermExtracts = pruned.map((entry) => ({
        keywords: extractKeywords(entry),
        blurb: entry.summary,
        domain: entry.domain,
      }));
    }

    // Step 4: Store in long-term memory
    for (const extract of longTermExtracts) {
      const sourceContext = `Demoted from mid-term memory (domain: ${extract.domain})`;
      this.longTerm.store(
        extract.domain,
        extract.keywords,
        extract.blurb,
        sourceContext,
      );
    }

    return {
      entriesDecayed,
      entriesPruned,
      entriesDemotedToLongTerm: longTermExtracts.length,
    };
  }

  /**
   * Run the full compaction cycle: compact a specific short-term store,
   * then run mid-term maintenance.
   */
  async runFull(
    traceId: string,
    completionFn?: StructuredCompletionFn,
  ): Promise<CompactionStats> {
    const { insightsPromoted } = await this.compactShortTerm(
      traceId,
      completionFn,
    );
    const { entriesDecayed, entriesPruned, entriesDemotedToLongTerm } =
      await this.compactMidTerm(completionFn);

    return {
      insightsPromoted,
      entriesDecayed,
      entriesPruned,
      entriesDemotedToLongTerm,
    };
  }
}

/**
 * Extract keywords from a mid-term entry for long-term indexing.
 * Splits the key and domain on common delimiters.
 */
function extractKeywords(entry: MidTermEntry): string[] {
  const parts = new Set<string>();

  // Split key on hyphens, underscores, spaces, colons
  for (const token of entry.key.split(/[-_\s:]+/)) {
    const cleaned = token.trim().toLowerCase();
    if (cleaned.length > 1) parts.add(cleaned);
  }

  // Add domain parts
  for (const token of entry.domain.split(/[-_\s:]+/)) {
    const cleaned = token.trim().toLowerCase();
    if (cleaned.length > 1) parts.add(cleaned);
  }

  // Ensure at least one keyword
  if (parts.size === 0) {
    parts.add(entry.key.toLowerCase() || "unknown");
  }

  return [...parts];
}
