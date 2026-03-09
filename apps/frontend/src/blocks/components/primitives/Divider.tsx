import type { BlockProps } from "../../registry";

export function Divider({ block }: BlockProps) {
  const { variant = "line", spacing = "8px" } = block.props as {
    variant?: "line" | "space";
    spacing?: string;
  };

  const isDefaultSpacing = spacing === "8px";

  if (variant === "space") {
    return (
      <div
        className="block-divider block-divider--space"
        style={isDefaultSpacing ? undefined : { height: spacing }}
      />
    );
  }

  return (
    <hr
      className="block-divider block-divider--line"
      style={isDefaultSpacing ? undefined : { margin: `${spacing} 0` }}
    />
  );
}
