import { useEffect, useCallback, useState } from "react";

export interface GlobalShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

export interface GlobalShortcutsResult {
  /** Whether the help overlay is visible */
  helpVisible: boolean;
  /** Toggle help overlay */
  toggleHelp: () => void;
  /** Dismiss help overlay */
  dismissHelp: () => void;
}

/**
 * Hook that registers global keyboard shortcuts:
 * - ? to toggle the shortcut help overlay
 * - / to focus the chat input (search)
 * - Escape to dismiss overlays
 */
export function useGlobalShortcuts(
  options: GlobalShortcutsOptions = {},
): GlobalShortcutsResult {
  const { enabled = true } = options;
  const [helpVisible, setHelpVisible] = useState(false);

  const toggleHelp = useCallback(() => setHelpVisible((v) => !v), []);
  const dismissHelp = useCallback(() => setHelpVisible(false), []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const isEditable = (e.target as HTMLElement).isContentEditable;

      // Escape always works, even in inputs
      if (e.key === "Escape") {
        if (helpVisible) {
          e.preventDefault();
          setHelpVisible(false);
        }
        return;
      }

      // Don't intercept when typing in an input
      if (isInput || isEditable) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpVisible((v) => !v);
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        // Focus the chat input textarea
        const textarea = document.querySelector(
          ".chat-input textarea",
        ) as HTMLElement | null;
        if (textarea) {
          textarea.focus();
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, helpVisible]);

  return { helpVisible, toggleHelp, dismissHelp };
}
