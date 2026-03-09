import type { BlockProps } from "../../registry";

export function List({ block, children }: BlockProps) {
  const { gap = "4px" } = block.props as { gap?: string };

  return (
    <div
      className="block-list"
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
