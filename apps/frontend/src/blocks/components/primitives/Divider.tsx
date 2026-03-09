import type { BlockProps } from "../../registry";

export function Divider({ block }: BlockProps) {
  const { variant = "line", spacing = "8px" } = block.props as {
    variant?: "line" | "space";
    spacing?: string;
  };

  if (variant === "space") {
    return <div className="block-divider block-divider--space" style={{ height: spacing }} />;
  }

  return (
    <hr
      className="block-divider block-divider--line"
      style={{
        border: "none",
        borderTop: "1px solid var(--color-border)",
        margin: `${spacing} 0`,
      }}
    />
  );
}
