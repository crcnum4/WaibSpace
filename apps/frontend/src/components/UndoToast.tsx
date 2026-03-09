import { useCallback, useEffect, useRef, useState } from "react";
import type { ReversibleAction } from "../hooks/useActionHistory";

interface UndoToastProps {
  /** The action that was just undone, or null to hide the toast. */
  action: ReversibleAction | null;
  /** Called when the user clicks the Redo button. */
  onRedo: () => void;
  /** Called when the toast is dismissed (timeout or manual). */
  onDismiss: () => void;
  /** Auto-dismiss timeout in ms. Defaults to 5000. */
  timeout?: number;
}

const ACTION_LABELS: Record<string, string> = {
  archive: "Archive",
  mark_read: "Mark as read",
  snooze: "Snooze",
};

export function UndoToast({
  action,
  onRedo,
  onDismiss,
  timeout = 5000,
}: UndoToastProps) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActionIdRef = useRef<string | null>(null);

  const startDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  // Reset animation state when a new action arrives.
  useEffect(() => {
    if (!action) {
      setExiting(false);
      prevActionIdRef.current = null;
      return;
    }

    if (action.id !== prevActionIdRef.current) {
      setExiting(false);
      prevActionIdRef.current = action.id;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(startDismiss, timeout);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [action, startDismiss, timeout]);

  if (!action) return null;

  const typeLabel = ACTION_LABELS[action.type] || action.type;

  return (
    <div
      className={`undo-toast${exiting ? " undo-toast--exiting" : ""}`}
      role="alert"
    >
      <span className="undo-toast__icon" aria-hidden="true">
        &#x21B6;
      </span>
      <div className="undo-toast__body">
        <p className="undo-toast__title">{typeLabel} undone</p>
        <p className="undo-toast__message">{action.label}</p>
      </div>
      <button className="undo-toast__redo" onClick={onRedo}>
        Redo
      </button>
      <button
        className="undo-toast__dismiss"
        onClick={startDismiss}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
