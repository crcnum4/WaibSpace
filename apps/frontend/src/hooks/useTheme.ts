import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light" | "auto";

const STORAGE_KEY = "waibspace-theme";
const VALID_THEMES: Theme[] = ["dark", "light", "auto"];

/* ---------- external store ---------- */

let listeners: Array<() => void> = [];

function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_THEMES.includes(stored as Theme)) {
    return stored as Theme;
  }
  return "dark"; // default matches existing dark palette
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/* ---------- hook ---------- */

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  // Apply data-theme attribute whenever the value changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    // Notify all subscribers
    listeners.forEach((l) => l());
  }, []);

  return { theme, setTheme } as const;
}

/* ---------- early init (call from main.tsx before render) ---------- */

export function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const theme: Theme =
    stored && VALID_THEMES.includes(stored as Theme)
      ? (stored as Theme)
      : "dark";
  applyTheme(theme);
}
