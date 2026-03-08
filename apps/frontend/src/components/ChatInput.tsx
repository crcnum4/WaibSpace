import { useState } from "react";

export function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setHistory((prev) => [text.trim(), ...prev]);
    setText("");
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "ArrowUp") {
      const next = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      if (history[next]) setText(history[next]);
    }
  };

  return (
    <div className="chat-input">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask WaibSpace anything..."
        rows={1}
      />
      <button onClick={handleSubmit} disabled={!text.trim()}>
        Send
      </button>
    </div>
  );
}
