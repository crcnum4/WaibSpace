import type { BlockProps } from "../../registry";

export function Stack({ block, children }: BlockProps) {
  const { align, gap, className = "" } = block.props as {
    align?: string;
    gap?: string;
    className?: string;
  };

  const style: React.CSSProperties = {};
  if (align) style.alignItems = align;
  if (gap) style.gap = gap;

  return (
    <div
      className={`block-stack ${className}`.trim()}
      style={Object.keys(style).length > 0 ? style : undefined}
    >
      {children}
    </div>
  );
}
