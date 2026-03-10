import type { WaibDatabase } from "@waibspace/db";
import type { Database } from "bun:sqlite";

export interface LongTermEntry {
  id: string;
  domain: string;
  keywords: string[];
  blurb: string;
  sourceContext?: string;
  createdAt: number;
  lastAccessedAt: number;
}

interface LongTermRow {
  id: string;
  domain: string;
  keywords: string;
  blurb: string;
  source_context: string | null;
  created_at: number;
  last_accessed_at: number;
}

export class LongTermMemory {
  private db: Database;

  constructor(waibDb: WaibDatabase) {
    this.db = waibDb.getRawDb();
  }

  private rowToEntry(row: LongTermRow): LongTermEntry {
    return {
      id: row.id,
      domain: row.domain,
      keywords: row.keywords.split(",").map((k) => k.trim()),
      blurb: row.blurb,
      sourceContext: row.source_context ?? undefined,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
    };
  }

  /**
   * Escape a query string for FTS5 MATCH syntax.
   * Wraps each term in double quotes so special characters are treated as literals.
   * Multiple terms are joined with OR for broad matching.
   */
  private escapeFtsQuery(query: string): string {
    const terms = query
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `"${t.replace(/"/g, '""')}"`);
    if (terms.length === 0) return '""';
    return terms.join(" OR ");
  }

  /**
   * Store a long-term memory entry.
   * ID is derived from domain + sorted keywords.
   * Upserts: if the entry already exists, updates blurb, source_context, and last_accessed_at.
   */
  store(
    domain: string,
    keywords: string[],
    blurb: string,
    sourceContext?: string,
  ): void {
    const sortedKeywords = [...keywords].sort();
    const id = `${domain}:${sortedKeywords.join(",")}`;
    const keywordsStr = sortedKeywords.join(", ");
    const now = Date.now();

    this.db
      .query(
        `INSERT INTO longterm_memory (id, domain, keywords, blurb, source_context, created_at, last_accessed_at)
         VALUES ($id, $domain, $keywords, $blurb, $source_context, $created_at, $last_accessed_at)
         ON CONFLICT(id) DO UPDATE SET
           blurb = excluded.blurb,
           source_context = excluded.source_context,
           last_accessed_at = excluded.last_accessed_at`,
      )
      .run({
        $id: id,
        $domain: domain,
        $keywords: keywordsStr,
        $blurb: blurb,
        $source_context: sourceContext ?? null,
        $created_at: now,
        $last_accessed_at: now,
      });
  }

  /**
   * Recall entries matching a full-text query.
   * Touches last_accessed_at for all returned entries.
   */
  recall(query: string, limit = 10): LongTermEntry[] {
    const ftsQuery = this.escapeFtsQuery(query);
    const rows = this.db
      .query(
        `SELECT m.* FROM longterm_memory m
         WHERE m.rowid IN (
           SELECT rowid FROM longterm_memory_fts WHERE longterm_memory_fts MATCH $query
         )
         ORDER BY m.last_accessed_at DESC
         LIMIT $limit`,
      )
      .all({ $query: ftsQuery, $limit: limit }) as LongTermRow[];

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const now = Date.now();
      const placeholders = ids.map(() => "?").join(", ");
      this.db
        .query(
          `UPDATE longterm_memory SET last_accessed_at = ? WHERE id IN (${placeholders})`,
        )
        .run(now, ...ids);
    }

    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Recall entries scoped to a domain, optionally filtered by FTS query.
   * If no query is provided, returns all entries for the domain sorted by last_accessed_at DESC.
   */
  recallByDomain(domain: string, query?: string, limit = 10): LongTermEntry[] {
    let rows: LongTermRow[];

    if (query) {
      const ftsQuery = this.escapeFtsQuery(query);
      rows = this.db
        .query(
          `SELECT m.* FROM longterm_memory m
           WHERE m.domain = $domain
             AND m.rowid IN (
               SELECT rowid FROM longterm_memory_fts WHERE longterm_memory_fts MATCH $query
             )
           ORDER BY m.last_accessed_at DESC
           LIMIT $limit`,
        )
        .all({ $domain: domain, $query: ftsQuery, $limit: limit }) as LongTermRow[];
    } else {
      rows = this.db
        .query(
          `SELECT * FROM longterm_memory
           WHERE domain = $domain
           ORDER BY last_accessed_at DESC
           LIMIT $limit`,
        )
        .all({ $domain: domain, $limit: limit }) as LongTermRow[];
    }

    // Touch accessed entries
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const now = Date.now();
      const placeholders = ids.map(() => "?").join(", ");
      this.db
        .query(
          `UPDATE longterm_memory SET last_accessed_at = ? WHERE id IN (${placeholders})`,
        )
        .run(now, ...ids);
    }

    return rows.map((r) => this.rowToEntry(r));
  }

  /** Update last_accessed_at for a specific entry. */
  touch(id: string): void {
    this.db
      .query(`UPDATE longterm_memory SET last_accessed_at = $now WHERE id = $id`)
      .run({ $now: Date.now(), $id: id });
  }

  /** Get entries where last_accessed_at is older than the given threshold. */
  getStale(olderThanMs: number): LongTermEntry[] {
    const cutoff = Date.now() - olderThanMs;
    const rows = this.db
      .query(
        `SELECT * FROM longterm_memory
         WHERE last_accessed_at < $cutoff
         ORDER BY last_accessed_at ASC`,
      )
      .all({ $cutoff: cutoff }) as LongTermRow[];

    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Recall entries and format them as context for an LLM prompt.
   * Returns a markdown section with keyword-tagged blurbs.
   */
  toContext(query: string, limit = 5): string {
    const entries = this.recall(query, limit);
    if (entries.length === 0) return "";

    const lines = entries.map(
      (e) => `- [${e.keywords.join(", ")}]: ${e.blurb}`,
    );
    return `## Background Knowledge\n${lines.join("\n")}\n`;
  }
}
