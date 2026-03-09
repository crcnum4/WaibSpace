import type { BlockProps } from "../../registry";

export function Badge({ block }: BlockProps) {
  const { content = "", variant = "label", color = "var(--color-accent)" } =
    block.props as {
      content?: string;
      variant?: "dot" | "label" | "count";
      color?: string;
    };

  if (variant === "dot") {
    return (
      <span
        className="block-badge block-badge--dot"
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
    );
  }

  return (
    <span
      className={`block-badge block-badge--${variant}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: variant === "count" ? "9999px" : "var(--radius-sm, 4px)",
        backgroundColor: "var(--color-accent-subtle)",
        color,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-medium)",
      }}
    >
      {content}
    </span>
  );
}
