import type { BlockProps } from "../../registry";

export function Row({ block, children }: BlockProps) {
  const { align = "center", justify = "flex-start", gap = "0" } =
    block.props as {
      align?: string;
      justify?: string;
      gap?: string;
    };

  return (
    <div
      className="block-row"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: align,
        justifyContent: justify,
        gap,
      }}
    >
      {children}
    </div>
  );
}
