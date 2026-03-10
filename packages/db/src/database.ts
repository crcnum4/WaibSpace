import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface MemoryRow {
  id: string;
  category: string;
  key: string;
  value: string; // JSON-stringified
  source: string;
  created_at: number;
  updated_at: number;
}

export interface MCPServerRow {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args: string | null; // JSON-stringified string[]
  env: string | null; // JSON-stringified Record<string, string>
  url: string | null;
  trust_level: string;
  enabled: number; // 0 or 1
  created_at: number;
}

export interface EventLogRow {
  id: string;
  event_type: string;
  source: string;
  trace_id: string;
  payload: string; // JSON-stringified
  level: string;
  created_at: number;
}

export class WaibDatabase {
  private db: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id         TEXT PRIMARY KEY,
        category   TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        source     TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_category ON memory(category);
      CREATE INDEX IF NOT EXISTS idx_memory_updated  ON memory(updated_at);
    `);

    // FTS5 virtual table for full-text search on memory
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        id,
        key,
        value,
        content=memory,
        content_rowid=rowid
      );
    `);

    // Triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory BEGIN
        INSERT INTO memory_fts(rowid, id, key, value)
        VALUES (new.rowid, new.id, new.key, new.value);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, id, key, value)
        VALUES ('delete', old.rowid, old.id, old.key, old.value);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, id, key, value)
        VALUES ('delete', old.rowid, old.id, old.key, old.value);
        INSERT INTO memory_fts(rowid, id, key, value)
        VALUES (new.rowid, new.id, new.key, new.value);
      END;
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        id          TEXT PRIMARY KEY,
        event_type  TEXT NOT NULL,
        source      TEXT NOT NULL,
        trace_id    TEXT NOT NULL,
        payload     TEXT NOT NULL DEFAULT '{}',
        level       TEXT NOT NULL DEFAULT 'info',
        created_at  INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_event_log_trace ON event_log(trace_id);
      CREATE INDEX IF NOT EXISTS idx_event_log_level ON event_log(level);
      CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);

      CREATE TABLE IF NOT EXISTS mcp_servers (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        transport   TEXT NOT NULL,
        command     TEXT,
        args        TEXT,
        env         TEXT,
        url         TEXT,
        trust_level TEXT NOT NULL DEFAULT 'semi-trusted',
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  INTEGER NOT NULL
      );
    `);

    // Mid-term memory: domain-scoped working knowledge with relevance decay
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS midterm_memory (
        id                  TEXT PRIMARY KEY,
        domain              TEXT NOT NULL,
        key                 TEXT NOT NULL,
        summary             TEXT NOT NULL,
        relevance_score     REAL DEFAULT 1.0,
        access_count        INTEGER DEFAULT 0,
        reinforcement_count INTEGER DEFAULT 0,
        created_at          INTEGER NOT NULL,
        updated_at          INTEGER NOT NULL,
        last_accessed_at    INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_midterm_domain ON midterm_memory(domain);
      CREATE INDEX IF NOT EXISTS idx_midterm_relevance ON midterm_memory(relevance_score);
    `);

    // Long-term memory table (three-tier memory model)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS longterm_memory (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        keywords TEXT NOT NULL,
        blurb TEXT NOT NULL,
        source_context TEXT,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_longterm_domain ON longterm_memory(domain);
      CREATE INDEX IF NOT EXISTS idx_longterm_accessed ON longterm_memory(last_accessed_at);
    `);

    // FTS5 virtual table for full-text search on long-term memory
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS longterm_memory_fts USING fts5(
        keywords, blurb,
        content=longterm_memory,
        content_rowid=rowid
      );
    `);

    // Triggers to keep long-term memory FTS in sync (same pattern as memory_fts)
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS longterm_memory_ai AFTER INSERT ON longterm_memory BEGIN
        INSERT INTO longterm_memory_fts(rowid, keywords, blurb)
        VALUES (new.rowid, new.keywords, new.blurb);
      END;

      CREATE TRIGGER IF NOT EXISTS longterm_memory_ad AFTER DELETE ON longterm_memory BEGIN
        INSERT INTO longterm_memory_fts(longterm_memory_fts, rowid, keywords, blurb)
        VALUES ('delete', old.rowid, old.keywords, old.blurb);
      END;

      CREATE TRIGGER IF NOT EXISTS longterm_memory_au AFTER UPDATE ON longterm_memory BEGIN
        INSERT INTO longterm_memory_fts(longterm_memory_fts, rowid, keywords, blurb)
        VALUES ('delete', old.rowid, old.keywords, old.blurb);
        INSERT INTO longterm_memory_fts(rowid, keywords, blurb)
        VALUES (new.rowid, new.keywords, new.blurb);
      END;
    `);
  }

  // ---- Memory CRUD ----

  setMemory(entry: {
    id: string;
    category: string;
    key: string;
    value: unknown;
    source: string;
    createdAt: number;
    updatedAt: number;
  }): void {
    this.db
      .query(
        `INSERT INTO memory (id, category, key, value, source, created_at, updated_at)
         VALUES ($id, $category, $key, $value, $source, $created_at, $updated_at)
         ON CONFLICT(id) DO UPDATE SET
           value = excluded.value,
           source = excluded.source,
           updated_at = excluded.updated_at`,
      )
      .run({
        $id: entry.id,
        $category: entry.category,
        $key: entry.key,
        $value: JSON.stringify(entry.value),
        $source: entry.source,
        $created_at: entry.createdAt,
        $updated_at: entry.updatedAt,
      });
  }

  getMemory(id: string): MemoryRow | null {
    return (
      (this.db.query("SELECT * FROM memory WHERE id = $id").get({ $id: id }) as MemoryRow | null) ??
      null
    );
  }

  getAllMemory(category: string): MemoryRow[] {
    return this.db
      .query("SELECT * FROM memory WHERE category = $category")
      .all({ $category: category }) as MemoryRow[];
  }

  searchMemory(category: string, query: string): MemoryRow[] {
    // Use FTS5 for full-text search, join back to memory for full row
    return this.db
      .query(
        `SELECT m.* FROM memory m
         JOIN memory_fts fts ON m.rowid = fts.rowid
         WHERE m.category = $category
           AND memory_fts MATCH $query`,
      )
      .all({ $category: category, $query: query }) as MemoryRow[];
  }

  getRecentMemory(category: string, limit: number): MemoryRow[] {
    return this.db
      .query(
        "SELECT * FROM memory WHERE category = $category ORDER BY updated_at DESC LIMIT $limit",
      )
      .all({ $category: category, $limit: limit }) as MemoryRow[];
  }

  deleteMemory(id: string): boolean {
    const result = this.db.query("DELETE FROM memory WHERE id = $id").run({ $id: id });
    return result.changes > 0;
  }

  // ---- MCP Server CRUD ----

  saveMCPServer(row: MCPServerRow): void {
    this.db
      .query(
        `INSERT INTO mcp_servers (id, name, transport, command, args, env, url, trust_level, enabled, created_at)
         VALUES ($id, $name, $transport, $command, $args, $env, $url, $trust_level, $enabled, $created_at)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           transport = excluded.transport,
           command = excluded.command,
           args = excluded.args,
           env = excluded.env,
           url = excluded.url,
           trust_level = excluded.trust_level,
           enabled = excluded.enabled`,
      )
      .run({
        $id: row.id,
        $name: row.name,
        $transport: row.transport,
        $command: row.command,
        $args: row.args,
        $env: row.env,
        $url: row.url,
        $trust_level: row.trust_level,
        $enabled: row.enabled,
        $created_at: row.created_at,
      });
  }

  getMCPServers(): MCPServerRow[] {
    return this.db.query("SELECT * FROM mcp_servers").all() as MCPServerRow[];
  }

  deleteMCPServer(id: string): boolean {
    const result = this.db.query("DELETE FROM mcp_servers WHERE id = $id").run({ $id: id });
    return result.changes > 0;
  }

  // ---- Event Log ----

  logEvent(entry: {
    id: string;
    eventType: string;
    source: string;
    traceId: string;
    payload: unknown;
    level: "info" | "warn" | "error";
    createdAt: number;
  }): void {
    this.db
      .query(
        `INSERT INTO event_log (id, event_type, source, trace_id, payload, level, created_at)
         VALUES ($id, $event_type, $source, $trace_id, $payload, $level, $created_at)`,
      )
      .run({
        $id: entry.id,
        $event_type: entry.eventType,
        $source: entry.source,
        $trace_id: entry.traceId,
        $payload: JSON.stringify(entry.payload),
        $level: entry.level,
        $created_at: entry.createdAt,
      });
  }

  getEventsByTrace(traceId: string): EventLogRow[] {
    return this.db
      .query("SELECT * FROM event_log WHERE trace_id = $trace_id ORDER BY created_at ASC")
      .all({ $trace_id: traceId }) as EventLogRow[];
  }

  getRecentEvents(limit: number, level?: string): EventLogRow[] {
    if (level) {
      return this.db
        .query("SELECT * FROM event_log WHERE level = $level ORDER BY created_at DESC LIMIT $limit")
        .all({ $level: level, $limit: limit }) as EventLogRow[];
    }
    return this.db
      .query("SELECT * FROM event_log ORDER BY created_at DESC LIMIT $limit")
      .all({ $limit: limit }) as EventLogRow[];
  }

  // ---- Generic query helpers (for packages that manage their own tables) ----

  /** Run a write query (INSERT, UPDATE, DELETE) with named parameters. */
  run(sql: string, params?: Record<string, string | number | null>): void {
    this.db.query(sql).run(params ?? {});
  }

  /** Get a single row from a read query. */
  getOne(sql: string, params?: Record<string, string | number | null>): unknown {
    return this.db.query(sql).get(params ?? {});
  }

  /** Get all rows from a read query. */
  getAll(sql: string, params?: Record<string, string | number | null>): unknown[] {
    return this.db.query(sql).all(params ?? {});
  }

  /** Expose underlying Database for packages that need raw SQL (e.g. LongTermMemory). */
  getRawDb(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
