export type WaibEventType =
  | "user.message.received"
  | "user.voice.transcribed"
  | "user.interaction.clicked"
  | "user.interaction.dragged"
  | "user.intent.url_received"
  | "intent.inferred"
  | "intent.ambiguous"
  | "context.requested"
  | "context.source.returned"
  | "surface.proposed"
  | "surface.composed"
  | "policy.check.requested"
  | "policy.check.result"
  | "policy.approval.required"
  | "policy.approval.response"
  | "execution.requested"
  | "execution.completed"
  | "background.task.triggered"
  | "background.task.complete"
  | "system.poll"
  | "briefing.alert"
  | "memory.updated";

export interface WaibEvent {
  id: string;
  type: WaibEventType;
  timestamp: number;
  source: string;
  traceId: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}
