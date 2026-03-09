import { useCallback, useEffect, useState } from "react";
import type { WebSocketMessage } from "./useWebSocket";
import type { Notification } from "../components/NotificationToast";

let nextId = 0;

interface TaskCompletePayload {
  taskId: string;
  taskName: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Listens to WebSocket messages and manages a stack of notifications.
 * Currently handles `task.complete` messages from the background scheduler.
 */
export function useNotifications(lastMessage: WebSocketMessage | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "task.complete") return;

    const payload = lastMessage.payload as TaskCompletePayload;

    const notification: Notification = {
      id: `notif-${++nextId}`,
      type: payload.success ? "success" : "error",
      title: payload.success
        ? `${payload.taskName} completed`
        : `${payload.taskName} failed`,
      message: payload.success
        ? `Finished in ${(payload.durationMs / 1000).toFixed(1)}s`
        : payload.error,
      createdAt: Date.now(),
    };

    setNotifications((prev) => [...prev, notification]);
  }, [lastMessage]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, dismiss };
}
