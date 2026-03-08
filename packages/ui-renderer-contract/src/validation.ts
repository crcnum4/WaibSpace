import type { ServerMessage, ClientMessage } from "./messages";

const SERVER_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "surface.update",
  "surface.partial",
  "approval.request",
  "status",
  "error",
]);

const CLIENT_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "user.message",
  "user.interaction",
  "user.intent.url",
  "approval.response",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidServerMessage(msg: unknown): msg is ServerMessage {
  if (!isObject(msg)) return false;
  if (typeof msg.type !== "string") return false;
  if (!("payload" in msg)) return false;
  return SERVER_MESSAGE_TYPES.has(msg.type);
}

export function isValidClientMessage(msg: unknown): msg is ClientMessage {
  if (!isObject(msg)) return false;
  if (typeof msg.type !== "string") return false;
  if (!("payload" in msg)) return false;
  return CLIENT_MESSAGE_TYPES.has(msg.type);
}
