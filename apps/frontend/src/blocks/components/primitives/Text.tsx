import type { BlockProps } from "../../registry";

const variantConfig: Record<string, { tag: string; className: string }> = {
  h1: { tag: "h1", className: "block-text--h1" },
  h2: { tag: "h2", className: "block-text--h2" },
  h3: { tag: "h3", className: "block-text--h3" },
  body: { tag: "p", className: "block-text--body" },
  caption: { tag: "span", className: "block-text--caption" },
  label: { tag: "span", className: "block-text--label" },
  bold: { tag: "span", className: "block-text--bold" },
  heading: { tag: "h3", className: "block-text--heading" },
};

export function Text({ block }: BlockProps) {
  const { content = "", variant = "body", color, weight, className = "" } = block.props as {
    content: string;
    variant?: string;
    color?: string;
    weight?: string;
    className?: string;
  };

  const config = variantConfig[variant] ?? variantConfig.body;
  const Tag = config.tag as keyof JSX.IntrinsicElements;

  // Only use inline styles for dynamic overrides from props
  const style: React.CSSProperties = {};
  if (color) style.color = color;
  if (weight) style.fontWeight = weight;

  return (
    <Tag
      className={`block-text ${config.className} ${className}`.trim()}
      style={Object.keys(style).length > 0 ? style : undefined}
    >
      {content}
    </Tag>
  );
}
