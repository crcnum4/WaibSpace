import type { BlockProps } from "../../registry";

export function Container({ block, children }: BlockProps) {
  const {
    direction,
    gap,
    padding,
    className = "",
  } = block.props as {
    direction?: "row" | "column";
    gap?: string;
    padding?: string;
    className?: string;
  };

  const style: React.CSSProperties = {};
  if (direction === "row") style.flexDirection = "row";
  if (gap) style.gap = gap;
  if (padding) style.padding = padding;

  return (
    <div
      className={`block-container ${className}`.trim()}
      style={Object.keys(style).length > 0 ? style : undefined}
    >
      {children}
    </div>
  );
}
