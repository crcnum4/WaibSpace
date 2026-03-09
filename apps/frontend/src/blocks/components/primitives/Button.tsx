import type { BlockProps } from "../../registry";

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: "var(--color-accent)",
    color: "#fff",
    border: "none",
  },
  secondary: {
    background: "transparent",
    color: "var(--color-text)",
    border: "1px solid var(--color-border-strong)",
  },
  danger: {
    background: "var(--color-error, #ef4444)",
    color: "#fff",
    border: "none",
  },
};

export function Button({ block, onEvent }: BlockProps) {
  const { label = "", variant = "primary", disabled = false } = block.props as {
    label: string;
    variant?: "primary" | "secondary" | "danger";
    riskClass?: "A" | "B" | "C";
    disabled?: boolean;
  };

  return (
    <button
      className={`block-button block-button--${variant}`}
      disabled={disabled}
      onClick={() => onEvent?.("click")}
      style={{
        ...variantStyles[variant],
        padding: "6px 16px",
        borderRadius: "var(--radius-md, 6px)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-medium)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-sans)",
      }}
    >
      {label}
    </button>
  );
}
