import type { MemoryEntry, MemoryCategory } from "@waibspace/types";
import { EventBus, createEvent } from "@waibspace/event-bus";

export class MemoryStore {
  private store: Map<string, MemoryEntry>;
  private dirty: boolean;
  private autoSaveInterval?: ReturnType<typeof setInterval>;

  constructor(
    private persistPath?: string,
    private eventBus?: EventBus,
  ) {
    this.store = new Map();
    this.dirty = false;
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
    return this.store.get(`${category}:${key}`);
  }

  getAll(category: MemoryCategory): MemoryEntry[] {
    return Array.from(this.store.values()).filter(
      (e) => e.category === category,
    );
  }

  update(id: string, value: unknown): MemoryEntry | undefined {
    const entry = this.store.get(id);
    if (!entry) return undefined;
    entry.value = value;
    entry.updatedAt = Date.now();
    this.dirty = true;
    return entry;
  }

  delete(id: string): boolean {
    this.dirty = true;
    return this.store.delete(id);
  }

  // Query

  search(category: MemoryCategory, query: string): MemoryEntry[] {
    return this.getAll(category).filter(
      (e) => e.key.includes(query) || JSON.stringify(e.value).includes(query),
    );
  }

  getRecent(category: MemoryCategory, limit: number): MemoryEntry[] {
    return this.getAll(category)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  // Persistence (JSON file)

  async save(): Promise<void> {
    if (!this.persistPath || !this.dirty) return;
    const data = Array.from(this.store.values());
    await Bun.write(this.persistPath, JSON.stringify(data, null, 2));
    this.dirty = false;
  }

  async load(): Promise<void> {
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
