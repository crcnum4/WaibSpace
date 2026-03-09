import { useCallback, useEffect, useRef, useState } from "react";

/** Actions that support undo/redo. */
export type ReversibleActionType = "archive" | "mark_read" | "snooze";

export interface ReversibleAction {
  id: string;
  type: ReversibleActionType;
  /** Human-readable label, e.g. "Archived email from Alice" */
  label: string;
  /** Payload sent with the original action so it can be re-dispatched on redo. */
  forwardPayload: unknown;
  /** Payload to send when undoing this action. */
  undoPayload: unknown;
  /** Timestamp when the action was executed. */
  timestamp: number;
}

export interface ActionHistoryState {
  /** Whether an undo is available. */
  canUndo: boolean;
  /** Whether a redo is available. */
  canRedo: boolean;
  /** The most recent undone action (shown in the toast). */
  lastUndone: ReversibleAction | null;
  /** Push a new action onto the history stack. */
  push: (action: Omit<ReversibleAction, "id" | "timestamp">) => void;
  /** Undo the most recent action. Returns the action that was undone, or null. */
  undo: () => ReversibleAction | null;
  /** Redo the most recently undone action. Returns the action, or null. */
  redo: () => ReversibleAction | null;
  /** Dismiss the lastUndone notification. */
  dismissUndo: () => void;
}

let nextActionId = 0;

const MAX_HISTORY = 50;

/**
 * Hook that maintains an undo/redo stack for reversible user actions.
 *
 * Registers Ctrl+Z (undo) and Ctrl+Shift+Z / Ctrl+Y (redo) keyboard shortcuts.
 *
 * @param onUndo - Called when an action is undone, with the undo payload.
 * @param onRedo - Called when an action is redone, with the forward payload.
 */
export function useActionHistory(
  onUndo: (action: ReversibleAction) => void,
  onRedo: (action: ReversibleAction) => void,
): ActionHistoryState {
  const [undoStack, setUndoStack] = useState<ReversibleAction[]>([]);
  const [redoStack, setRedoStack] = useState<ReversibleAction[]>([]);
  const [lastUndone, setLastUndone] = useState<ReversibleAction | null>(null);

  // Keep stable refs so the keyboard handler doesn't re-bind on every render.
  const undoStackRef = useRef(undoStack);
  const redoStackRef = useRef(redoStack);
  undoStackRef.current = undoStack;
  redoStackRef.current = redoStack;

  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  onUndoRef.current = onUndo;
  onRedoRef.current = onRedo;

  const push = useCallback(
    (partial: Omit<ReversibleAction, "id" | "timestamp">) => {
      const action: ReversibleAction = {
        ...partial,
        id: `action-${++nextActionId}`,
        timestamp: Date.now(),
      };
      setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), action]);
      // New action clears the redo stack.
      setRedoStack([]);
      setLastUndone(null);
    },
    [],
  );

  const undo = useCallback((): ReversibleAction | null => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return null;

    const action = stack[stack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, action]);
    setLastUndone(action);
    onUndoRef.current(action);
    return action;
  }, []);

  const redo = useCallback((): ReversibleAction | null => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return null;

    const action = stack[stack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, action]);
    setLastUndone(null);
    onRedoRef.current(action);
    return action;
  }, []);

  const dismissUndo = useCallback(() => {
    setLastUndone(null);
  }, []);

  // Register keyboard shortcuts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const isEditable = (e.target as HTMLElement).isContentEditable;

      // Don't intercept when typing in an input.
      if (isInput || isEditable) return;

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier || e.altKey) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    lastUndone,
    push,
    undo,
    redo,
    dismissUndo,
  };
}
