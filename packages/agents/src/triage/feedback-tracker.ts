/**
 * TriageFeedbackTracker — learns from user interactions with triaged items
 * to adjust triage thresholds over time.
 *
 * When a user opens a "low" urgency email, maybe the triage threshold is
 * too aggressive. When they ignore a "medium" item, maybe it's too lenient.
 * These signals are stored in mid-term memory under "preferences:triage".
 */

import type { MidTermMemory } from "@waibspace/memory";
import type { UrgencyLevel } from "./types";

export type UserAction = "opened" | "ignored" | "replied" | "deleted";

export interface TriageFeedback {
  itemId: string;
  originalUrgency: UrgencyLevel;
  userAction: UserAction;
  timestamp: number;
}

/**
 * Weight map for how much each action-urgency combination affects the bias.
 * Positive = user thinks urgency should be higher; negative = lower.
 */
const ACTION_SIGNALS: Record<UserAction, Record<UrgencyLevel, number>> = {
  // User opened something low → threshold too aggressive (+)
  opened: { low: 0.1, medium: 0.0, high: 0.0 },
  // User replied to something low → definitely too aggressive
  replied: { low: 0.2, medium: 0.05, high: 0.0 },
  // User ignored something medium/high → threshold too lenient (-)
  ignored: { low: 0.0, medium: -0.1, high: -0.15 },
  // User deleted something medium/high → threshold too lenient (-)
  deleted: { low: 0.0, medium: -0.05, high: -0.2 },
};

export class TriageFeedbackTracker {
  private feedbackBuffer: TriageFeedback[] = [];
  private readonly maxBufferSize = 100;

  constructor(private midTerm: MidTermMemory) {}

  /**
   * Record when user interacts with a triaged item.
   * Used to adjust triage thresholds over time.
   */
  recordFeedback(feedback: TriageFeedback): void {
    this.feedbackBuffer.push(feedback);

    // Keep buffer bounded
    if (this.feedbackBuffer.length > this.maxBufferSize) {
      this.feedbackBuffer = this.feedbackBuffer.slice(-this.maxBufferSize);
    }

    // Persist the running signal to mid-term memory
    const signal =
      ACTION_SIGNALS[feedback.userAction]?.[feedback.originalUrgency] ?? 0;
    if (signal !== 0) {
      const adjustments = this.getThresholdAdjustments();
      const summary = `Triage urgency bias: ${adjustments.urgencyBias.toFixed(3)} (from ${this.feedbackBuffer.length} signals)`;
      this.midTerm.store("preferences:triage", "urgency-bias", summary);
    }
  }

  /**
   * Get threshold adjustments based on accumulated feedback.
   * Returns a bias value:
   *   positive → urgency should be boosted (user engages with low-urgency items)
   *   negative → urgency should be reduced (user ignores high-urgency items)
   */
  getThresholdAdjustments(): { urgencyBias: number } {
    if (this.feedbackBuffer.length === 0) {
      return { urgencyBias: 0 };
    }

    let totalSignal = 0;
    for (const fb of this.feedbackBuffer) {
      const signal = ACTION_SIGNALS[fb.userAction]?.[fb.originalUrgency] ?? 0;
      totalSignal += signal;
    }

    // Normalize by buffer size, capped to [-1, 1]
    const raw = totalSignal / this.feedbackBuffer.length;
    const urgencyBias = Math.max(-1, Math.min(1, raw));

    return { urgencyBias };
  }

  /** Number of feedback signals currently buffered. */
  get bufferSize(): number {
    return this.feedbackBuffer.length;
  }
}
