import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export interface UseWebSocketReturn {
  send: (type: string, payload?: unknown) => void;
  lastMessage: WebSocketMessage | null;
  status: ConnectionStatus;
}

/**
 * Connect to a backend WebSocket on mount.
 * Auto-reconnects on disconnect with exponential backoff.
 */
export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const connect = useCallback(() => {
    setStatus("connecting");

    const ws = new WebSocket(urlRef.current);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      retriesRef.current = 0;
      setStatus("connected");
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
  }, []);

  function scheduleReconnect() {
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { send, lastMessage, status };
}
