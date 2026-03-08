import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SurfaceSpec } from "@waibspace/types";
import { useWebSocket } from "../hooks/useWebSocket";

export default function IntentResolutionPage() {
  const location = useLocation();
  const { send, lastMessage, status } = useWebSocket("ws://localhost:3001/ws");
  const [surfaces, setSurfaces] = useState<SurfaceSpec[]>([]);
  const [loading, setLoading] = useState(true);

  // Extract intent from path
  const intentPath = location.pathname.replace(/^\//, "");
  const intentQuery = intentPath.replace(/[-_]/g, " ");

  useEffect(() => {
    // Send intent to backend
    send("user.intent.url", { path: intentPath, raw: location.pathname });
    setLoading(true);
  }, [intentPath, send]);

  useEffect(() => {
    // Listen for surface responses
    if (lastMessage?.type === "surface.update") {
      const payload = lastMessage.payload as { surfaces: SurfaceSpec[] };
      setSurfaces(payload.surfaces);
      setLoading(false);
    }
  }, [lastMessage]);

  return (
    <div className="intent-resolution">
      <div className="intent-header">
        <span className="intent-label">Interpreting:</span>
        <span className="intent-query">{intentQuery}</span>
      </div>
      {loading ? (
        <div className="intent-loading">
          <p>Analyzing your intent...</p>
          {status === "connected" && (
            <p className="agent-status">Agents working...</p>
          )}
        </div>
      ) : (
        <div className="intent-results">
          {surfaces.map((s) => (
            <div key={s.surfaceId} className="surface-placeholder">
              <h3>{s.title}</h3>
              <p>{s.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
