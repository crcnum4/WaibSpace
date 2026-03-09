import type { BlockProps } from "../../registry";

export function Grid({ block, children }: BlockProps) {
  const { columns = 2, gap = "8px", minItemWidth } = block.props as {
    columns?: number;
    gap?: string;
    minItemWidth?: string;
  };

  const gridTemplateColumns = minItemWidth
    ? `repeat(auto-fill, minmax(${minItemWidth}, 1fr))`
    : `repeat(${columns}, 1fr)`;

  return (
    <div
      className="block-grid"
      style={{ gridTemplateColumns, gap }}
    >
      {children}
    </div>
  );
}
