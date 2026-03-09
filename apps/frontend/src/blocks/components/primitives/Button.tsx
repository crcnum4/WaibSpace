import type { BlockProps } from "../../registry";

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
    >
      {label}
    </button>
  );
}
