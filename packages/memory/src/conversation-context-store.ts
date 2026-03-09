import type { ConversationTurn } from "@waibspace/types";

/**
 * Default maximum number of turns retained per session.
 * Keeps context bounded while providing enough history for
 * multi-turn reference resolution ("Reply to her latest").
 */
const DEFAULT_MAX_TURNS = 20;

export interface ConversationContextStoreOptions {
  /** Maximum number of turns to retain per session (sliding window). */
  maxTurns?: number;
  /** Time-to-live in ms for idle sessions before they are pruned. Default: 30 minutes. */
  sessionTtlMs?: number;
}

/**
 * In-memory conversation context store.
 *
 * Tracks recent user messages and assistant responses per session so
 * downstream agents can resolve anaphoric references ("her", "that email")
 * across turns.
 *
 * Uses a sliding window to prevent unbounded growth.
 */
export class ConversationContextStore {
  private sessions = new Map<string, ConversationTurn[]>();
  private readonly maxTurns: number;
  private readonly sessionTtlMs: number;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(options?: ConversationContextStoreOptions) {
    this.maxTurns = options?.maxTurns ?? DEFAULT_MAX_TURNS;
    this.sessionTtlMs = options?.sessionTtlMs ?? 30 * 60 * 1000; // 30 min
  }

  /**
   * Append a turn to a session's history.
   * If the window exceeds `maxTurns`, the oldest turn is dropped.
   */
  addTurn(sessionId: string, turn: ConversationTurn): void {
    let history = this.sessions.get(sessionId);
    if (!history) {
      history = [];
      this.sessions.set(sessionId, history);
    }
    history.push(turn);

    // Sliding window: trim from the front
    if (history.length > this.maxTurns) {
      const excess = history.length - this.maxTurns;
      history.splice(0, excess);
    }
  }

  /**
   * Retrieve the conversation history for a session.
   * Returns an empty array if the session doesn't exist.
   *
   * @param limit - Optional cap on the number of most-recent turns to return.
   */
  getHistory(sessionId: string, limit?: number): ConversationTurn[] {
    const history = this.sessions.get(sessionId) ?? [];
    if (limit !== undefined && limit < history.length) {
      return history.slice(-limit);
    }
    return [...history];
  }

  /**
   * Clear conversation history for a specific session.
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Return the number of active sessions.
   */
  sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Start a periodic cleanup that prunes sessions whose last activity
   * is older than `sessionTtlMs`.
   */
  startCleanup(intervalMs = 60_000): void {
    this.cleanupInterval = setInterval(() => this.pruneStale(), intervalMs);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [sessionId, history] of this.sessions) {
      if (history.length === 0) {
        this.sessions.delete(sessionId);
        continue;
      }
      const lastTurn = history[history.length - 1];
      if (now - lastTurn.timestamp > this.sessionTtlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
