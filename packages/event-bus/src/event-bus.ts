import type { WaibEvent } from "@waibspace/types";

export type Unsubscribe = () => void;
export type EventHandler = (event: WaibEvent) => void | Promise<void>;

/**
 * Convert a glob pattern (e.g. "user.*") to a RegExp.
 * Supports `*` as a wildcard matching any segment(s).
 */
function patternToRegex(pattern: string): RegExp {
  // Escape regex special chars except `*`
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // Replace `*` with `.*` for glob-style matching
  const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexStr);
}

export interface EventBusOptions {
  /** Maximum number of events to retain in history. Default: 1000. */
  historySize?: number;
}

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private anyHandlers = new Set<EventHandler>();
  private history: WaibEvent[] = [];
  private readonly historySize: number;

  constructor(options?: EventBusOptions) {
    this.historySize = options?.historySize ?? 1000;
  }

  /**
   * Emit an event. Handlers are invoked synchronously; any returned promises
   * are fire-and-forget. One handler failing does not block others.
   */
  emit(event: WaibEvent): void {
    // Record in history
    this.history.push(event);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    // Notify pattern-matched handlers
    for (const [pattern, handlerSet] of this.handlers) {
      if (this.matches(pattern, event.type)) {
        for (const handler of handlerSet) {
          this.safeInvoke(handler, event);
        }
      }
    }

    // Notify wildcard (any) handlers
    for (const handler of this.anyHandlers) {
      this.safeInvoke(handler, event);
    }
  }

  /**
   * Subscribe to events matching the given pattern.
   * Supports glob patterns, e.g. "user.*" matches "user.message.received".
   * Returns an unsubscribe function.
   */
  on(eventType: string, handler: EventHandler): Unsubscribe {
    let handlerSet = this.handlers.get(eventType);
    if (!handlerSet) {
      handlerSet = new Set();
      this.handlers.set(eventType, handlerSet);
    }
    handlerSet.add(handler);

    return () => {
      this.off(eventType, handler);
    };
  }

  /**
   * Subscribe to a single occurrence of events matching the given pattern.
   * The handler is automatically removed after the first invocation.
   */
  once(eventType: string, handler: EventHandler): void {
    const wrappedHandler: EventHandler = (event) => {
      this.off(eventType, wrappedHandler);
      return handler(event);
    };
    this.on(eventType, wrappedHandler);
  }

  /**
   * Subscribe to all events regardless of type (wildcard for logging/tracing).
   * Returns an unsubscribe function.
   */
  onAny(handler: EventHandler): Unsubscribe {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  /**
   * Remove a handler for the given event pattern.
   */
  off(eventType: string, handler: EventHandler): void {
    const handlerSet = this.handlers.get(eventType);
    if (handlerSet) {
      handlerSet.delete(handler);
      if (handlerSet.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Return the most recent events from history.
   * @param limit - Number of events to return. Defaults to all.
   */
  getHistory(limit?: number): WaibEvent[] {
    if (limit === undefined) {
      return [...this.history];
    }
    return this.history.slice(-limit);
  }

  /**
   * Clear all stored event history.
   */
  clearHistory(): void {
    this.history = [];
  }

  // ---- Private helpers ----

  private matches(pattern: string, eventType: string): boolean {
    if (pattern === eventType) return true;
    if (!pattern.includes("*")) return false;
    return patternToRegex(pattern).test(eventType);
  }

  private safeInvoke(handler: EventHandler, event: WaibEvent): void {
    try {
      const result = handler(event);
      // If handler returns a promise, catch rejections to avoid unhandled errors
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((err) => {
          console.error("[EventBus] async handler error:", err);
        });
      }
    } catch (err) {
      console.error("[EventBus] handler error:", err);
    }
  }
}
