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
      style={{
        padding: "8px 12px",
        cursor: "pointer",
        borderRadius: "var(--radius-sm, 4px)",
        transition: "background-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </div>
  );
}
