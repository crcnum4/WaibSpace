import type { BlockProps } from "../../registry";

export function Stack({ block, children }: BlockProps) {
  const { align = "stretch", gap = "0" } = block.props as {
    align?: string;
    gap?: string;
  };

  return (
    <div
      className="block-stack"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        gap,
      }}
    >
      {children}
    </div>
  );
}
