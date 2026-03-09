import type { BlockProps } from "../../registry";

const sharedStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm, 4px)",
  color: "var(--color-text)",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-sans)",
  outline: "none",
  resize: "vertical",
};

export function TextInput({ block, onEvent }: BlockProps) {
  const { placeholder = "", rows, value = "" } = block.props as {
    placeholder?: string;
    rows?: number;
    value?: string;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    onEvent?.("change", { value: e.target.value });
  };

  if (rows && rows > 1) {
    return (
      <textarea
        className="block-text-input"
        placeholder={placeholder}
        defaultValue={value}
        rows={rows}
        onChange={handleChange}
        style={sharedStyle}
      />
    );
  }

  return (
    <input
      type="text"
      className="block-text-input"
      placeholder={placeholder}
      defaultValue={value}
      onChange={handleChange}
      style={{ ...sharedStyle, resize: undefined }}
    />
  );
}
