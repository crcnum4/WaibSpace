import type { BlockProps } from "../../registry";

export function Container({ block, children }: BlockProps) {
  const {
    direction = "column",
    gap = "0",
    padding = "0",
    className = "",
  } = block.props as {
    direction?: "row" | "column";
    gap?: string;
    padding?: string;
    className?: string;
  };

  return (
    <div
      className={`block-container ${className}`.trim()}
      style={{
        display: "flex",
        flexDirection: direction,
        gap,
        padding,
      }}
    >
      {children}
    </div>
  );
}
