import type { Database } from "bun:sqlite";

export function runMigrations(db: Database): void {
  // Schema version tracking
  db.run(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);

  const currentVersion =
    (
      db
        .prepare(`SELECT MAX(version) as v FROM schema_version`)
        .get() as { v: number | null }
    )?.v ?? 0;

  if (currentVersion < 1) {
    migration001(db);
    db.run(`INSERT INTO schema_version (version) VALUES (1)`);
  }

  if (currentVersion < 2) {
    migration002(db);
    db.run(`INSERT INTO schema_version (version) VALUES (2)`);
  }
}

function migration001(db: Database): void {
  // Phase 1 tables (active)

  db.run(`CREATE TABLE IF NOT EXISTS memory_entries (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_entries(category)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_memory_updated ON memory_entries(updated_at DESC)`
  );

  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    key, value, source,
    content='memory_entries',
    content_rowid='rowid'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    transport TEXT NOT NULL,
    command TEXT,
    args TEXT,
    env TEXT,
    url TEXT,
    trust_level TEXT NOT NULL DEFAULT 'semi-trusted',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_log (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_events_trace ON event_log(trace_id)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_events_type ON event_log(event_type, created_at DESC)`
  );

  db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // Phase 2 tables (schema only, populated later)

  db.run(`CREATE TABLE IF NOT EXISTS component_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    surface_type TEXT NOT NULL,
    description TEXT,
    template TEXT NOT NULL,
    tags TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_templates_type ON component_templates(surface_type)`
  );

  db.run(`CREATE TABLE IF NOT EXISTS compositions (
    id TEXT PRIMARY KEY,
    intent TEXT NOT NULL,
    templates_used TEXT NOT NULL,
    surface_spec TEXT NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    last_used_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_compositions_intent ON compositions(intent)`
  );

  db.run(`CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    surface_id TEXT NOT NULL,
    surface_type TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    signal TEXT NOT NULL,
    value TEXT,
    trace_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_feedback_surface ON user_feedback(surface_id)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(surface_type, feedback_type)`
  );
}

function migration002(db: Database): void {
  // Long-term memory table (three-tier memory model)

  db.run(`CREATE TABLE IF NOT EXISTS longterm_memory (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    keywords TEXT NOT NULL,
    blurb TEXT NOT NULL,
    source_context TEXT,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL
  )`);

  db.run(
    `CREATE INDEX IF NOT EXISTS idx_longterm_domain ON longterm_memory(domain)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_longterm_accessed ON longterm_memory(last_accessed_at)`
  );

  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS longterm_memory_fts USING fts5(
    keywords, blurb,
    content='longterm_memory',
    content_rowid='rowid'
  )`);

  // Sync triggers (same pattern as memory_fts in WaibDatabase.migrate)
  db.run(`CREATE TRIGGER IF NOT EXISTS longterm_memory_ai AFTER INSERT ON longterm_memory BEGIN
    INSERT INTO longterm_memory_fts(rowid, keywords, blurb)
    VALUES (new.rowid, new.keywords, new.blurb);
  END`);

  db.run(`CREATE TRIGGER IF NOT EXISTS longterm_memory_ad AFTER DELETE ON longterm_memory BEGIN
    INSERT INTO longterm_memory_fts(longterm_memory_fts, rowid, keywords, blurb)
    VALUES ('delete', old.rowid, old.keywords, old.blurb);
  END`);

  db.run(`CREATE TRIGGER IF NOT EXISTS longterm_memory_au AFTER UPDATE ON longterm_memory BEGIN
    INSERT INTO longterm_memory_fts(longterm_memory_fts, rowid, keywords, blurb)
    VALUES ('delete', old.rowid, old.keywords, old.blurb);
    INSERT INTO longterm_memory_fts(rowid, keywords, blurb)
    VALUES (new.rowid, new.keywords, new.blurb);
  END`);
}
