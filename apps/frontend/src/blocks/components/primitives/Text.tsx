import type { BlockProps } from "../../registry";

const variantConfig: Record<string, { tag: string; fontSize: string; fontWeight: string }> = {
  h1: { tag: "h1", fontSize: "var(--text-4xl)", fontWeight: "var(--weight-bold)" },
  h2: { tag: "h2", fontSize: "var(--text-3xl)", fontWeight: "var(--weight-semibold)" },
  h3: { tag: "h3", fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" },
  body: { tag: "p", fontSize: "var(--text-base)", fontWeight: "var(--weight-normal)" },
  caption: { tag: "span", fontSize: "var(--text-sm)", fontWeight: "var(--weight-normal)" },
  label: { tag: "span", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" },
};

export function Text({ block }: BlockProps) {
  const { content = "", variant = "body", color, weight } = block.props as {
    content: string;
    variant?: "h1" | "h2" | "h3" | "body" | "caption" | "label";
    color?: string;
    weight?: string;
  };

  const config = variantConfig[variant] ?? variantConfig.body;
  const Tag = config.tag as keyof JSX.IntrinsicElements;

  return (
    <Tag
      className="block-text"
      style={{
        margin: 0,
        fontSize: config.fontSize,
        fontWeight: weight ?? config.fontWeight,
        color: color ?? "var(--color-text)",
        lineHeight: "var(--leading-normal)",
      }}
    >
      {content}
    </Tag>
  );
}
