import { useEffect, useRef } from "react";

interface ShortcutEntry {
  key: string;
  description: string;
}

const SHORTCUT_GROUPS: { title: string; shortcuts: ShortcutEntry[] }[] = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "j", description: "Move to next email" },
      { key: "k", description: "Move to previous email" },
      { key: "Enter", description: "Open selected email" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { key: "a", description: "Archive selected email" },
      { key: "r", description: "Reply to selected email" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { key: "/", description: "Focus chat input" },
      { key: "?", description: "Toggle this help" },
      { key: "Esc", description: "Dismiss overlay" },
    ],
  },
];

interface KeyboardShortcutHelpProps {
  visible: boolean;
  onDismiss: () => void;
}

export function KeyboardShortcutHelp({
  visible,
  onDismiss,
}: KeyboardShortcutHelpProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Trap focus inside the overlay when visible
  useEffect(() => {
    if (!visible) return;
    const overlay = overlayRef.current;
    if (overlay) overlay.focus();
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="kb-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onDismiss}
    >
      <div
        className="kb-help-panel"
        ref={overlayRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kb-help-header">
          <h2 className="kb-help-title">Keyboard Shortcuts</h2>
          <button
            className="kb-help-close"
            onClick={onDismiss}
            aria-label="Close shortcuts help"
          >
            Esc
          </button>
        </div>

        <div className="kb-help-body">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="kb-help-group">
              <h3 className="kb-help-group-title">{group.title}</h3>
              <dl className="kb-help-list">
                {group.shortcuts.map((s) => (
                  <div key={s.key} className="kb-help-entry">
                    <dt className="kb-help-key">
                      <kbd>{s.key}</kbd>
                    </dt>
                    <dd className="kb-help-desc">{s.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <p className="kb-help-footer">
          Press <kbd>?</kbd> to toggle this overlay
        </p>
      </div>
    </div>
  );
}
