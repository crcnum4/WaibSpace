import type { BlockProps } from "../../registry";

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
    />
  );
}
