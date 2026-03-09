import type { BlockProps } from "../../registry";

export function Row({ block, children }: BlockProps) {
  const { align, justify, gap, className = "" } = block.props as {
    align?: string;
    justify?: string;
    gap?: string;
    className?: string;
  };

  // Only set inline styles for non-default prop values
  const style: React.CSSProperties = {};
  if (align) style.alignItems = align;
  if (justify) style.justifyContent = justify;
  if (gap) style.gap = gap;

  return (
    <div
      className={`block-row ${className}`.trim()}
      style={Object.keys(style).length > 0 ? style : undefined}
    >
      {children}
    </div>
  );
}
