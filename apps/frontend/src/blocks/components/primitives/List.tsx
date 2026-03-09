import type { BlockProps } from "../../registry";

export function List({ block, children }: BlockProps) {
  const { gap = "4px", className = "" } = block.props as {
    gap?: string;
    className?: string;
  };

  return (
    <div
      className={`block-list ${className}`.trim()}
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {children}
    </div>
  );
}
