import { EventBus, createEvent } from "@waibspace/event-bus";

export interface AlertPayload {
  itemId: string;
  cardType: "action-card";
  title: string;
  context: string;
  urgency: "high";
  source: string;
  suggestedAction?: string;
  timestamp: number;
}

export class AlertEmitter {
  private sentAlerts = new Map<string, number>(); // itemId -> timestamp
  private readonly dedupeWindowMs = 5 * 60 * 1000; // 5 minutes

  constructor(private bus: EventBus) {}

  /**
   * Check triage results and emit alerts for high-urgency items.
   * Deduplicates: won't send the same alert twice within the window.
   */
  emitAlerts(
    triageItems: Array<{
      raw: unknown;
      triage: {
        itemId: string;
        urgency: string;
        category: string;
        reasoning?: string;
        suggestedAction?: string;
      };
    }>,
    connectorId: string,
    traceId: string,
  ): void {
    const now = Date.now();
    this.cleanStaleEntries(now);

    for (const item of triageItems) {
      if (item.triage.urgency !== "high") continue;
      if (this.sentAlerts.has(item.triage.itemId)) continue;

      const raw = item.raw as Record<string, unknown>;
      const payload: AlertPayload = {
        itemId: item.triage.itemId,
        cardType: "action-card",
        title:
          (raw.subject as string) ??
          (raw.title as string) ??
          "Urgent item",
        context: `From ${(raw.from as string) ?? (raw.sender as string) ?? "unknown"} via ${connectorId}`,
        urgency: "high",
        source: connectorId,
        suggestedAction: item.triage.suggestedAction,
        timestamp: now,
      };

      const event = createEvent(
        "briefing.alert",
        payload,
        "alert-emitter",
        traceId,
      );
      this.bus.emit(event);

      this.sentAlerts.set(item.triage.itemId, now);
    }
  }

  private cleanStaleEntries(now: number): void {
    for (const [id, timestamp] of this.sentAlerts) {
      if (now - timestamp > this.dedupeWindowMs) {
        this.sentAlerts.delete(id);
      }
    }
  }

  /** Reset tracking (e.g., when user acknowledges all alerts). */
  clearTracking(): void {
    this.sentAlerts.clear();
  }
}
