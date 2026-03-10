/**
 * Tracks user absence and accumulates background events that occur while
 * the user is away. When the user returns after the configured threshold,
 * the tracker provides a summary of what happened.
 */
export class AwayTracker {
  private lastActivity: number = Date.now();
  private awayThresholdMs: number = 30 * 60 * 1000; // 30 minutes
  private accumulatedEvents: Array<{
    type: string;
    summary: string;
    timestamp: number;
    connectorId?: string;
  }> = [];
  private readonly maxEvents = 100;

  /**
   * Record user activity (called on any user interaction or WS message).
   */
  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Record a background event that happened while the user might be away.
   */
  recordBackgroundEvent(event: {
    type: string;
    summary: string;
    connectorId?: string;
  }): void {
    this.accumulatedEvents.push({
      ...event,
      timestamp: Date.now(),
    });
    if (this.accumulatedEvents.length > this.maxEvents) {
      this.accumulatedEvents = this.accumulatedEvents.slice(-this.maxEvents);
    }
  }

  /**
   * Check if user was away and return accumulated events if so.
   * Clears the accumulated events after returning them.
   */
  checkAndGetAwaySummary(): {
    wasAway: boolean;
    durationMs: number;
    events: Array<{
      type: string;
      summary: string;
      timestamp: number;
      connectorId?: string;
    }>;
  } | null {
    const now = Date.now();
    const durationMs = now - this.lastActivity;

    if (
      durationMs < this.awayThresholdMs ||
      this.accumulatedEvents.length === 0
    ) {
      return null;
    }

    const events = [...this.accumulatedEvents];
    this.accumulatedEvents = [];
    this.lastActivity = now;

    return { wasAway: true, durationMs, events };
  }

  /**
   * Format duration as human-readable string.
   */
  static formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0)
      return `${hours} hour${hours !== 1 ? "s" : ""}`;
    return `${hours}h ${remainingMinutes}m`;
  }
}
