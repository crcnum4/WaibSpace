import { useState, useRef, useEffect, useCallback } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder }: ChatInputProps) {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchMode, setSearchMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!text.trim()) return;
    const message = searchMode
      ? `Search across all services for: ${text.trim()}`
      : text.trim();
    onSend(message);
    setHistory((prev) => [text.trim(), ...prev]);
    setText("");
    setHistoryIndex(-1);
    if (searchMode) {
      setSearchMode(false);
    }
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
    if (e.key === "Escape" && searchMode) {
      setSearchMode(false);
    }
  };

  const toggleSearchMode = useCallback(() => {
    setSearchMode((prev) => !prev);
    textareaRef.current?.focus();
  }, []);

  // Global Cmd/Ctrl+K shortcut to toggle search mode
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleSearchMode();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [toggleSearchMode]);

  const activePlaceholder = searchMode
    ? "Search emails, calendar, and all connected services..."
    : placeholder ?? "Ask WaibSpace anything...";

  return (
    <div className={`chat-input${searchMode ? " chat-input--search" : ""}`}>
      {searchMode && (
        <span className="chat-input__search-icon" aria-hidden="true">
          &#x1F50D;
        </span>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={activePlaceholder}
        rows={1}
      />
      <button
        className="chat-input__search-toggle"
        onClick={toggleSearchMode}
        type="button"
        title="Toggle search mode (Cmd+K)"
        aria-pressed={searchMode}
      >
        {searchMode ? "Chat" : "Search"}
      </button>
      <button onClick={handleSubmit} disabled={!text.trim()}>
        {searchMode ? "Search" : "Send"}
      </button>
    </div>
  );
}
