import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export interface UseWebSocketReturn {
  send: (type: string, payload?: unknown) => void;
  lastMessage: WebSocketMessage | null;
  status: ConnectionStatus;
  /** Number of queued messages waiting to be sent on reconnect. */
  pendingCount: number;
}

/** Maximum reconnection attempts before giving up. */
const MAX_RETRIES = 10;

/** Maximum number of messages to buffer while disconnected. */
const MAX_QUEUE_SIZE = 50;

interface QueuedMessage {
  type: string;
  payload: unknown;
}

/**
 * Connect to a backend WebSocket on mount.
 * Auto-reconnects on disconnect with exponential backoff (up to MAX_RETRIES).
 * Messages sent while disconnected are queued and flushed on reconnect.
 */
export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef(url);
  const queueRef = useRef<QueuedMessage[]>([]);
  const hasConnectedRef = useRef(false);
  /** Guard against scheduling multiple reconnects from concurrent close/error. */
  const reconnectScheduledRef = useRef(false);

  urlRef.current = url;

  const flushQueue = useCallback((ws: WebSocket) => {
    const pending = queueRef.current.splice(0);
    setPendingCount(0);
    for (const msg of pending) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        // If send fails mid-flush, re-queue remaining messages
        queueRef.current.unshift(msg);
        setPendingCount(queueRef.current.length);
        break;
      }
    }
  }, []);

  const connect = useCallback(() => {
    // Prevent duplicate connections
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.CONNECTING ||
        existing.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    reconnectScheduledRef.current = false;

    setStatus(hasConnectedRef.current ? "reconnecting" : "connecting");

    const ws = new WebSocket(urlRef.current);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      retriesRef.current = 0;
      hasConnectedRef.current = true;
      setStatus("connected");

      // Flush any messages that were queued while disconnected
      if (queueRef.current.length > 0) {
        flushQueue(ws);
      }
    });

    ws.addEventListener("message", (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data as string);
        setLastMessage(data);
      } catch {
        // ignore non-JSON messages
      }
    });

    ws.addEventListener("close", () => {
      setStatus("disconnected");
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      ws.close();
    });
  }, [flushQueue]);

  function scheduleReconnect() {
    if (reconnectScheduledRef.current) return;

    if (retriesRef.current >= MAX_RETRIES) {
      console.warn(
        `[useWebSocket] Max retries (${MAX_RETRIES}) reached. Giving up.`,
      );
      setStatus("disconnected");
      return;
    }

    reconnectScheduledRef.current = true;
    const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
    retriesRef.current += 1;
    timerRef.current = setTimeout(connect, delay);
  }

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((type: string, payload?: unknown) => {
    const msg: QueuedMessage = { type, payload };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return;
    }

    // Queue the message for later delivery
    if (queueRef.current.length < MAX_QUEUE_SIZE) {
      queueRef.current.push(msg);
      setPendingCount(queueRef.current.length);
    } else {
      console.warn(
        `[useWebSocket] Message queue full (${MAX_QUEUE_SIZE}). Dropping message:`,
        type,
      );
    }
  }, []);

  return { send, lastMessage, status, pendingCount };
}
