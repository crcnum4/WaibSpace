import type { WaibEvent, WaibEventType } from "@waibspace/types";

/**
 * Generate a trace ID using crypto.randomUUID().
 */
export function createTraceId(): string {
  return crypto.randomUUID();
}

/**
 * Create a properly structured WaibEvent.
 */
export function createEvent(
  type: string,
  payload: unknown,
  source: string,
  traceId?: string,
): WaibEvent {
  return {
    id: crypto.randomUUID(),
    type: type as WaibEventType,
    timestamp: Date.now(),
    source,
    traceId: traceId ?? createTraceId(),
    payload,
  };
}
