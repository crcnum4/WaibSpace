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
      >
        <span className={`block-expandable__chevron${open ? " block-expandable__chevron--open" : ""}`}>
          &#9654;
        </span>
        {header}
      </button>
      {open && <div className="block-expandable__content">{children}</div>}
    </div>
  );
}
