import { useState } from "react";
import type { BlockProps } from "../../registry";

export function Expandable({ block, children }: BlockProps) {
  const { defaultOpen = false, header = "Details" } = block.props as {
    defaultOpen?: boolean;
    header?: string;
  };

  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="block-expandable">
      <button
        className="block-expandable__header"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "8px 0",
          background: "none",
          border: "none",
          color: "var(--color-text)",
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-medium)",
          fontFamily: "var(--font-sans)",
          cursor: "pointer",
        }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
          &#9654;
        </span>
        {header}
      </button>
      {open && <div className="block-expandable__content">{children}</div>}
    </div>
  );
}
