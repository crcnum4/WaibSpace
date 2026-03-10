import type { WaibDatabase } from "@waibspace/db";

export interface MidTermEntry {
  id: string;
  domain: string;
  key: string;
  summary: string;
  relevanceScore: number;
  accessCount: number;
  reinforcementCount: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

interface MidTermRow {
  id: string;
  domain: string;
  key: string;
  summary: string;
  relevance_score: number;
  access_count: number;
  reinforcement_count: number;
  created_at: number;
  updated_at: number;
  last_accessed_at: number;
}

function rowToEntry(row: MidTermRow): MidTermEntry {
  return {
    id: row.id,
    domain: row.domain,
    key: row.key,
    summary: row.summary,
    relevanceScore: row.relevance_score,
    accessCount: row.access_count,
    reinforcementCount: row.reinforcement_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

/**
 * Mid-term memory holds Waib's working knowledge — compact summaries of
 * recurring insights, domain-scoped with relevance decay. Backed by SQLite.
 */
export class MidTermMemory {
  private db: WaibDatabase;

  constructor(db: WaibDatabase) {
    this.db = db;
  }

  /**
   * Store or reinforce a mid-term memory entry.
   * Upsert: if domain+key exists, reinforce (+0.2 relevance, update summary, bump reinforcement_count).
   * If new: insert with relevance 1.0.
   */
  store(domain: string, key: string, summary: string): void {
    const id = `${domain}:${key}`;
    const now = Date.now();

    this.db.run(
      `INSERT INTO midterm_memory (id, domain, key, summary, relevance_score, access_count, reinforcement_count, created_at, updated_at, last_accessed_at)
       VALUES ($id, $domain, $key, $summary, 1.0, 0, 0, $now, $now, $now)
       ON CONFLICT(id) DO UPDATE SET
         summary = excluded.summary,
         relevance_score = MIN(midterm_memory.relevance_score + 0.2, 1.0),
         reinforcement_count = midterm_memory.reinforcement_count + 1,
         updated_at = excluded.updated_at,
         last_accessed_at = excluded.last_accessed_at`,
      { $id: id, $domain: domain, $key: key, $summary: summary, $now: now },
    );
  }

  /**
   * Retrieve a single entry by domain+key.
   * Touches the entry: updates last_accessed_at, increments access_count,
   * and boosts relevance by 0.1 (capped at 1.0).
   */
  get(domain: string, key: string): MidTermEntry | undefined {
    const id = `${domain}:${key}`;
    const now = Date.now();

    const row = this.db.getOne(
      `SELECT * FROM midterm_memory WHERE id = $id`,
      { $id: id },
    ) as MidTermRow | null;

    if (!row) return undefined;

    // Touch: update access metadata
    this.db.run(
      `UPDATE midterm_memory
       SET last_accessed_at = $now,
           access_count = access_count + 1,
           relevance_score = MIN(relevance_score + 0.1, 1.0)
       WHERE id = $id`,
      { $id: id, $now: now },
    );

    return rowToEntry({
      ...row,
      last_accessed_at: now,
      access_count: row.access_count + 1,
      relevance_score: Math.min(row.relevance_score + 0.1, 1.0),
    });
  }

  /**
   * Get entries by domain. Matches exact domain or domain as prefix
   * (e.g., "email" matches "email:personal"). Sorted by relevance DESC.
   */
  getByDomain(domain: string, limit = 20): MidTermEntry[] {
    const rows = this.db.getAll(
      `SELECT * FROM midterm_memory
       WHERE domain = $domain OR domain LIKE $prefix
       ORDER BY relevance_score DESC
       LIMIT $limit`,
      { $domain: domain, $prefix: `${domain}:%`, $limit: limit },
    ) as MidTermRow[];

    return rows.map(rowToEntry);
  }

  /**
   * Get global entries (domain = "global").
   */
  getGlobal(limit = 20): MidTermEntry[] {
    return this.getByDomain("global", limit);
  }

  /**
   * Apply time-based relevance decay to all entries not accessed today.
   * Formula: relevance_score *= 0.95^(daysSinceLastAccess)
   * Returns count of entries that were decayed.
   */
  applyDecay(): { decayed: number } {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    // Get entries not accessed today
    const rows = this.db.getAll(
      `SELECT id, relevance_score, last_accessed_at FROM midterm_memory
       WHERE last_accessed_at < $today`,
      { $today: todayMs },
    ) as Array<{ id: string; relevance_score: number; last_accessed_at: number }>;

    let decayed = 0;
    for (const row of rows) {
      const daysSinceAccess = (now - row.last_accessed_at) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.pow(0.95, daysSinceAccess);
      const newScore = row.relevance_score * decayFactor;

      this.db.run(
        `UPDATE midterm_memory SET relevance_score = $score WHERE id = $id`,
        { $score: newScore, $id: row.id },
      );
      decayed++;
    }

    return { decayed };
  }

  /**
   * Prune entries below the relevance threshold.
   * Returns the deleted entries (useful for long-term memory demotion).
   */
  prune(threshold = 0.1): MidTermEntry[] {
    const rows = this.db.getAll(
      `SELECT * FROM midterm_memory WHERE relevance_score < $threshold`,
      { $threshold: threshold },
    ) as MidTermRow[];

    if (rows.length > 0) {
      this.db.run(
        `DELETE FROM midterm_memory WHERE relevance_score < $threshold`,
        { $threshold: threshold },
      );
    }

    return rows.map(rowToEntry);
  }

  /**
   * Format mid-term memory entries as context for the AI.
   * Loads entries for given domains + "global", grouped by domain,
   * sorted by relevance within each domain.
   * Limits total output to ~2000 chars.
   */
  toContext(domains: string[]): string {
    const allDomains = [...new Set([...domains, "global"])];
    const domainEntries = new Map<string, MidTermEntry[]>();

    for (const domain of allDomains) {
      const entries = this.getByDomain(domain, 20);
      for (const entry of entries) {
        const group = domainEntries.get(entry.domain) ?? [];
        group.push(entry);
        domainEntries.set(entry.domain, group);
      }
    }

    if (domainEntries.size === 0) return "";

    let output = "## Working Knowledge\n\n";
    let totalLength = output.length;
    const maxLength = 2000;

    for (const [domain, entries] of domainEntries) {
      const header = `### ${domain}\n`;
      if (totalLength + header.length > maxLength) break;
      output += header;
      totalLength += header.length;

      // Sort by relevance descending within domain
      entries.sort((a, b) => b.relevanceScore - a.relevanceScore);

      for (const entry of entries) {
        const line = `- ${entry.key}: ${entry.summary}\n`;
        if (totalLength + line.length > maxLength) break;
        output += line;
        totalLength += line.length;
      }

      output += "\n";
      totalLength += 1;
    }

    return output;
  }
}
