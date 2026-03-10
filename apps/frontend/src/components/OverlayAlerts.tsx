import { useState, useEffect, useCallback } from "react";
import type { WebSocketMessage } from "../hooks/useWebSocket";

interface AlertData {
  itemId: string;
  cardType: string;
  title: string;
  context: string;
  urgency: string;
  source: string;
  suggestedAction?: string;
  timestamp: number;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 30_000;

interface OverlayAlertsProps {
  lastMessage: WebSocketMessage | null;
}

export function OverlayAlerts({ lastMessage }: OverlayAlertsProps) {
  const [alerts, setAlerts] = useState<AlertData[]>([]);

  // Listen for briefing.alert events from WebSocket
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "briefing.alert") return;

    const payload = lastMessage.payload as AlertData;
    setAlerts((prev) => {
      // Deduplicate by itemId
      const exists = prev.some((a) => a.itemId === payload.itemId);
      if (exists) return prev;
      // Keep only the most recent MAX_VISIBLE alerts
      return [...prev.slice(-(MAX_VISIBLE - 1)), payload];
    });
  }, [lastMessage]);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setTimeout(() => {
      setAlerts((prev) => prev.slice(1)); // Remove oldest
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [alerts]);

  const dismiss = useCallback((itemId: string) => {
    setAlerts((prev) => prev.filter((a) => a.itemId !== itemId));
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="overlay-alerts">
      {alerts.slice(0, MAX_VISIBLE).map((alert) => (
        <div key={alert.itemId} className="overlay-alerts__card">
          <div className="overlay-alerts__header">
            <span className="overlay-alerts__urgency-dot" />
            <span className="overlay-alerts__title">{alert.title}</span>
            <button
              className="overlay-alerts__dismiss"
              onClick={() => dismiss(alert.itemId)}
              aria-label="Dismiss alert"
            >
              &times;
            </button>
          </div>
          <div className="overlay-alerts__context">{alert.context}</div>
          {alert.suggestedAction && (
            <div className="overlay-alerts__action">
              Suggested: {alert.suggestedAction}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
