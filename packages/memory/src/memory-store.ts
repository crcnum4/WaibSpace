import type { MemoryEntry, MemoryCategory } from "@waibspace/types";
import type { WaibDatabase, MemoryRow } from "@waibspace/db";
import { EventBus, createEvent } from "@waibspace/event-bus";
import { existsSync, renameSync, readFileSync } from "node:fs";

export class MemoryStore {
  private store: Map<string, MemoryEntry>;
  private dirty: boolean;
  private autoSaveInterval?: ReturnType<typeof setInterval>;
  private db?: WaibDatabase;
  private persistPath?: string;
  private eventBus?: EventBus;

  constructor(dbOrPath?: WaibDatabase | string, eventBus?: EventBus) {
    this.store = new Map();
    this.dirty = false;
    this.eventBus = eventBus;

    if (typeof dbOrPath === "string") {
      this.persistPath = dbOrPath;
    } else if (dbOrPath) {
      this.db = dbOrPath;
      this.migrateJsonIfNeeded();
    }
  }

  /** Migrate legacy JSON file to SQLite if it exists. */
  private migrateJsonIfNeeded(): void {
    if (!this.db) return;
    const jsonPath = "./data/memory.json";
    if (existsSync(jsonPath)) {
      try {
        const entries: MemoryEntry[] = JSON.parse(readFileSync(jsonPath, "utf-8"));
        for (const entry of entries) {
          this.db.setMemory({
            id: entry.id,
            category: entry.category,
            key: entry.key,
            value: entry.value,
            source: entry.source,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          });
        }
        renameSync(jsonPath, jsonPath + ".migrated");
        console.log(`[memory] Migrated ${entries.length} entries from JSON to SQLite`);
      } catch {
        // ignore migration errors
      }
    }
  }

  private rowToEntry(row: MemoryRow): MemoryEntry {
    return {
      id: row.id,
      category: row.category as MemoryCategory,
      key: row.key,
      value: JSON.parse(row.value),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: row.source,
    };
  }

  // CRUD

  set(
    category: MemoryCategory,
    key: string,
    value: unknown,
    source: string,
  ): MemoryEntry {
    const id = `${category}:${key}`;
    const now = Date.now();

    if (this.db) {
      const existingRow = this.db.getMemory(id);
      const createdAt = existingRow ? existingRow.created_at : now;
      this.db.setMemory({ id, category, key, value, source, createdAt, updatedAt: now });
      const entry: MemoryEntry = { id, category, key, value, createdAt, updatedAt: now, source };
      if (this.eventBus) {
        this.eventBus.emit(createEvent("memory.updated", { entry }, "memory-store"));
      }
      return entry;
    }

    const existing = this.store.get(id);
    const entry: MemoryEntry = {
      id,
      category,
      key,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      source,
    };
    this.store.set(id, entry);
    this.dirty = true;
    if (this.eventBus) {
      this.eventBus.emit(
        createEvent("memory.updated", { entry }, "memory-store"),
      );
    }
    return entry;
  }

  get(category: MemoryCategory, key: string): MemoryEntry | undefined {
    if (this.db) {
      const row = this.db.getMemory(`${category}:${key}`);
      return row ? this.rowToEntry(row) : undefined;
    }
    return this.store.get(`${category}:${key}`);
  }

  getAll(category: MemoryCategory): MemoryEntry[] {
    if (this.db) {
      return this.db.getAllMemory(category).map((row) => this.rowToEntry(row));
    }
    return Array.from(this.store.values()).filter(
      (e) => e.category === category,
    );
  }

  update(id: string, value: unknown): MemoryEntry | undefined {
    if (this.db) {
      const row = this.db.getMemory(id);
      if (!row) return undefined;
      const entry = this.rowToEntry(row);
      entry.value = value;
      entry.updatedAt = Date.now();
      this.db.setMemory({
        id: entry.id,
        category: entry.category,
        key: entry.key,
        value: entry.value,
        source: entry.source,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
      return entry;
    }

    const entry = this.store.get(id);
    if (!entry) return undefined;
    entry.value = value;
    entry.updatedAt = Date.now();
    this.dirty = true;
    return entry;
  }

  delete(id: string): boolean {
    if (this.db) {
      return this.db.deleteMemory(id);
    }
    this.dirty = true;
    return this.store.delete(id);
  }

  // Query

  search(category: MemoryCategory, query: string): MemoryEntry[] {
    if (this.db) {
      try {
        return this.db.searchMemory(category, query).map((row) => this.rowToEntry(row));
      } catch {
        // FTS query syntax error — fall back to basic filtering
        return this.getAll(category).filter(
          (e) => e.key.includes(query) || JSON.stringify(e.value).includes(query),
        );
      }
    }
    return this.getAll(category).filter(
      (e) => e.key.includes(query) || JSON.stringify(e.value).includes(query),
    );
  }

  getRecent(category: MemoryCategory, limit: number): MemoryEntry[] {
    if (this.db) {
      return this.db.getRecentMemory(category, limit).map((row) => this.rowToEntry(row));
    }
    return this.getAll(category)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  // Persistence (JSON file — legacy fallback)

  async save(): Promise<void> {
    if (this.db) return; // SQLite writes are immediate
    if (!this.persistPath || !this.dirty) return;
    const data = Array.from(this.store.values());
    await Bun.write(this.persistPath, JSON.stringify(data, null, 2));
    this.dirty = false;
  }

  async load(): Promise<void> {
    if (this.db) return; // SQLite needs no explicit load
    if (!this.persistPath) return;
    try {
      const file = Bun.file(this.persistPath);
      if (await file.exists()) {
        const data: MemoryEntry[] = JSON.parse(await file.text());
        for (const entry of data) {
          this.store.set(entry.id, entry);
        }
      }
    } catch {
      // File doesn't exist or is corrupt — start fresh
    }
  }

  // Auto-save every 30 seconds if dirty

  startAutoSave(intervalMs = 30000): void {
    if (this.db) return; // No-op for SQLite
    this.autoSaveInterval = setInterval(() => this.save(), intervalMs);
  }

  stopAutoSave(): void {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
  }

  // Stats

  size(): number {
    return this.store.size;
  }
}
