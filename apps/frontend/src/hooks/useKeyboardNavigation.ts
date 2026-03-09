import { useEffect, useCallback, useRef, useState } from "react";

export interface KeyboardNavigationOptions {
  /** CSS selector for the list container */
  containerSelector: string;
  /** CSS selector for individual items within the container */
  itemSelector: string;
  /** Called when an item is selected (Enter key) */
  onSelect?: (index: number, element: HTMLElement) => void;
  /** Called when archive shortcut is pressed (a key) */
  onArchive?: (index: number, element: HTMLElement) => void;
  /** Called when reply shortcut is pressed (r key) */
  onReply?: (index: number, element: HTMLElement) => void;
  /** Whether navigation is enabled */
  enabled?: boolean;
}

export interface KeyboardNavigationResult {
  /** Currently focused item index (-1 = none) */
  activeIndex: number;
  /** Reset focus to nothing */
  reset: () => void;
}

/**
 * Hook for keyboard navigation of list items (j/k to move, Enter to select).
 * Focus is managed via a CSS class and aria-activedescendant rather than
 * moving real DOM focus, so the user can still type in the chat input.
 */
export function useKeyboardNavigation(
  options: KeyboardNavigationOptions,
): KeyboardNavigationResult {
  const {
    containerSelector,
    itemSelector,
    onSelect,
    onArchive,
    onReply,
    enabled = true,
  } = options;

  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const getItems = useCallback((): HTMLElement[] => {
    const container = document.querySelector(containerSelector);
    if (!container) return [];
    return Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
  }, [containerSelector, itemSelector]);

  const updateFocusClass = useCallback(
    (items: HTMLElement[], newIndex: number) => {
      items.forEach((el, i) => {
        el.classList.toggle("kb-focused", i === newIndex);
        if (i === newIndex) {
          el.setAttribute("aria-selected", "true");
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
          el.removeAttribute("aria-selected");
        }
      });
    },
    [],
  );

  const reset = useCallback(() => {
    const items = getItems();
    items.forEach((el) => {
      el.classList.remove("kb-focused");
      el.removeAttribute("aria-selected");
    });
    setActiveIndex(-1);
  }, [getItems]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when the user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      const items = getItems();
      if (items.length === 0) return;

      const current = activeIndexRef.current;

      switch (e.key) {
        case "j": {
          e.preventDefault();
          const next = Math.min(current + 1, items.length - 1);
          setActiveIndex(next);
          updateFocusClass(items, next);
          break;
        }
        case "k": {
          e.preventDefault();
          const prev = Math.max(current - 1, 0);
          setActiveIndex(prev);
          updateFocusClass(items, prev);
          break;
        }
        case "Enter": {
          if (current >= 0 && current < items.length) {
            e.preventDefault();
            onSelect?.(current, items[current]);
          }
          break;
        }
        case "a": {
          if (current >= 0 && current < items.length) {
            e.preventDefault();
            onArchive?.(current, items[current]);
          }
          break;
        }
        case "r": {
          if (current >= 0 && current < items.length) {
            e.preventDefault();
            onReply?.(current, items[current]);
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, getItems, updateFocusClass, onSelect, onArchive, onReply]);

  return { activeIndex, reset };
}
