import type { BlockProps } from "../../registry";

export function Badge({ block }: BlockProps) {
  const { content = "", variant = "label", color = "var(--color-accent)" } =
    block.props as {
      content?: string;
      variant?: "dot" | "label" | "count";
      color?: string;
    };

  if (variant === "dot") {
    const style: React.CSSProperties = {};
    if (color) style.backgroundColor = color;

    return (
      <span
        className="block-badge block-badge--dot"
        style={Object.keys(style).length > 0 ? style : undefined}
      />
    );
  }

  const style: React.CSSProperties = {};
  if (color) style.color = color;

  return (
    <span
      className={`block-badge block-badge--${variant}`}
      style={Object.keys(style).length > 0 ? style : undefined}
    >
      {content}
    </span>
  );
}
