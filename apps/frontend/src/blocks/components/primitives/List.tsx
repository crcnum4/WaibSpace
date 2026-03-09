import type { BlockProps } from "../../registry";

export function List({ block, children }: BlockProps) {
  const { gap, className = "" } = block.props as {
    gap?: string;
    className?: string;
  };

  return (
    <div
      className={`block-list ${className}`.trim()}
      style={gap ? { gap } : undefined}
    >
      {children}
    </div>
  );
}
