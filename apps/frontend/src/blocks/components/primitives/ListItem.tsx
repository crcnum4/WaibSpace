import type { BlockProps } from "../../registry";

export function ListItem({ block, children }: BlockProps) {
  const { swipeable = false, className = "" } = block.props as {
    swipeable?: boolean;
    className?: string;
  };

  return (
    <div
      className={`block-list-item ${className}`.trim()}
      data-swipeable={swipeable || undefined}
    >
      {children}
    </div>
  );
}
