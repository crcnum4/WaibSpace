import { useCallback, useEffect, useRef, useState } from "react";

export interface Notification {
  id: string;
  type: "success" | "error";
  title: string;
  message?: string;
  /** Timestamp when the notification was created (ms). */
  createdAt: number;
}

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  /** Auto-dismiss timeout in ms. Defaults to 6000. */
  timeout?: number;
}

function NotificationToastItem({
  notification,
  onDismiss,
  timeout = 6000,
}: NotificationToastProps) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDismiss = useCallback(() => {
    setExiting(true);
    // Wait for exit animation before removing
    setTimeout(() => onDismiss(notification.id), 200);
  }, [notification.id, onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(startDismiss, timeout);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startDismiss, timeout]);

  const variant = notification.type === "success" ? "success" : "error";
  const icon = notification.type === "success" ? "\u2713" : "\u2717";

  return (
    <div
      className={`notification-toast notification-toast--${variant}${exiting ? " notification-toast--exiting" : ""}`}
      role="alert"
    >
      <span className="notification-toast__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="notification-toast__body">
        <p className="notification-toast__title">{notification.title}</p>
        {notification.message && (
          <p className="notification-toast__message">{notification.message}</p>
        )}
      </div>
      <button
        className="notification-toast__dismiss"
        onClick={startDismiss}
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
}

const MAX_VISIBLE = 5;

interface NotificationStackProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationStack({
  notifications,
  onDismiss,
}: NotificationStackProps) {
  if (notifications.length === 0) return null;

  const visible = notifications.slice(-MAX_VISIBLE);

  return (
    <div className="notification-stack">
      {visible.map((n) => (
        <NotificationToastItem
          key={n.id}
          notification={n}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
