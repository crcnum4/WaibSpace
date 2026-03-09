import { useState } from "react";
import type { BlockProps } from "../registry";

export function FallbackBlock({ block }: BlockProps) {
  const [showProps, setShowProps] = useState(false);

  return (
    <div
      className="block-fallback"
      style={{
        border: "2px dashed var(--color-border-strong)",
        borderRadius: "var(--radius-md, 6px)",
        padding: "12px",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Unknown block: <strong style={{ color: "var(--color-text-secondary)" }}>{block.type}</strong>
        </span>
        <button
          onClick={() => setShowProps((p) => !p)}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm, 4px)",
            color: "var(--color-muted)",
            fontSize: "var(--text-xs)",
            padding: "2px 6px",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          {showProps ? "Hide" : "Props"}
        </button>
      </div>
      {showProps && (
        <pre
          style={{
            marginTop: "8px",
            padding: "8px",
            backgroundColor: "var(--color-bg)",
            borderRadius: "var(--radius-sm, 4px)",
            color: "var(--color-text-secondary)",
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-mono)",
            overflow: "auto",
            maxHeight: 200,
          }}
        >
          {JSON.stringify(block.props, null, 2)}
        </pre>
      )}
    </div>
  );
}
