import { useState, useCallback, useRef, Children, type DragEvent } from "react";
import type { BlockProps } from "../../../registry";

interface GmailInboxListProps {
  unreadCount: number;
  totalCount: number;
  isScanned: boolean;
  error?: string;
  isTruncated?: boolean;
  fullCount?: number;
}

// ---------------------------------------------------------------------------
// Drag-and-drop reorder wrapper for individual email cards
// ---------------------------------------------------------------------------

interface DragItemProps {
  index: number;
  totalCount: number;
  dragSourceIndex: number | null;
  dropTargetIndex: number | null;
  onDragStart: (index: number) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onMoveByKeyboard: (fromIndex: number, direction: "up" | "down") => void;
  children: React.ReactNode;
}

function DragItem({
  index,
  totalCount,
  dragSourceIndex,
  dropTargetIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onMoveByKeyboard,
  children,
}: DragItemProps) {
  const isDragSource = dragSourceIndex === index;
  const isDropTarget = dropTargetIndex === index;
  const isDragging = dragSourceIndex !== null;

  const wrapperClass = [
    "gmail-inbox-list__drag-item",
    isDragSource ? "gmail-inbox-list__drag-item--dragging" : "",
    isDropTarget ? "gmail-inbox-list__drag-item--drop-target" : "",
    isDragging && !isDragSource ? "gmail-inbox-list__drag-item--drag-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      onDragStart(index);
    },
    [index, onDragStart],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        onMoveByKeyboard(index, "up");
      } else if (e.key === "ArrowDown" && index < totalCount - 1) {
        e.preventDefault();
        onMoveByKeyboard(index, "down");
      }
    },
    [index, totalCount, onMoveByKeyboard],
  );

  return (
    <div
      className={wrapperClass}
      draggable
      onDragStart={handleDragStart}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <div className="gmail-inbox-list__drag-handle" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="4" cy="2.5" r="1" fill="currentColor" />
          <circle cx="8" cy="2.5" r="1" fill="currentColor" />
          <circle cx="4" cy="6" r="1" fill="currentColor" />
          <circle cx="8" cy="6" r="1" fill="currentColor" />
          <circle cx="4" cy="9.5" r="1" fill="currentColor" />
          <circle cx="8" cy="9.5" r="1" fill="currentColor" />
        </svg>
      </div>
      <div className="gmail-inbox-list__drag-content">{children}</div>
      <div className="gmail-inbox-list__reorder-btns" role="group" aria-label="Reorder email">
        <button
          type="button"
          className="gmail-inbox-list__reorder-btn"
          aria-label="Move up"
          disabled={index === 0}
          onClick={(e) => { e.stopPropagation(); onMoveByKeyboard(index, "up"); }}
          onKeyDown={handleKeyDown}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="gmail-inbox-list__reorder-btn"
          aria-label="Move down"
          disabled={index === totalCount - 1}
          onClick={(e) => { e.stopPropagation(); onMoveByKeyboard(index, "down"); }}
          onKeyDown={handleKeyDown}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GmailInboxList
// ---------------------------------------------------------------------------

export function GmailInboxList({ block, children, onEvent }: BlockProps) {
  const { unreadCount, totalCount, isScanned, error, isTruncated, fullCount } = block.props as GmailInboxListProps;
  const [isScanning, setIsScanning] = useState(false);

  // Drag-and-drop state
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [orderedIndices, setOrderedIndices] = useState<number[] | null>(null);

  const childArray = Children.toArray(children);
  const childCount = childArray.length;

  // Build the display order: if user has reordered, use that; otherwise natural order
  const displayOrder = orderedIndices && orderedIndices.length === childCount
    ? orderedIndices
    : childArray.map((_, i) => i);

  // Reset ordered indices when child count changes (new data arrived)
  const prevCountRef = useRef(childCount);
  if (prevCountRef.current !== childCount) {
    prevCountRef.current = childCount;
    if (orderedIndices !== null) {
      setOrderedIndices(null);
    }
  }

  const handleScan = () => {
    setIsScanning(true);
    onEvent?.("waib-scan", { scope: "all" });
  };

  const handleDragStart = useCallback((index: number) => {
    setDragSourceIndex(index);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }, []);

  const reorder = useCallback(
    (fromDisplayIdx: number, toDisplayIdx: number) => {
      if (fromDisplayIdx === toDisplayIdx) return;

      const current = [...displayOrder];
      const [moved] = current.splice(fromDisplayIdx, 1);
      current.splice(toDisplayIdx, 0, moved);
      setOrderedIndices(current);

      // Emit reorder event so orchestration layer can persist ordering
      onEvent?.("reorder-emails", {
        fromIndex: fromDisplayIdx,
        toIndex: toDisplayIdx,
        order: current,
      });
    },
    [displayOrder, onEvent],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (dragSourceIndex !== null && dropTargetIndex !== null) {
        reorder(dragSourceIndex, dropTargetIndex);
      }
      setDragSourceIndex(null);
      setDropTargetIndex(null);
    },
    [dragSourceIndex, dropTargetIndex, reorder],
  );

  const handleMoveByKeyboard = useCallback(
    (fromDisplayIdx: number, direction: "up" | "down") => {
      const toDisplayIdx = direction === "up" ? fromDisplayIdx - 1 : fromDisplayIdx + 1;
      if (toDisplayIdx < 0 || toDisplayIdx >= childCount) return;
      reorder(fromDisplayIdx, toDisplayIdx);
    },
    [childCount, reorder],
  );

  return (
    <div className="gmail-inbox-list" role="region" aria-label="Gmail Inbox">
      <div className="gmail-inbox-list__header">
        <div className="gmail-inbox-list__title-row">
          <h3 className="gmail-inbox-list__title">Inbox</h3>
          {!error && unreadCount > 0 && (
            <span className="gmail-inbox-list__badge" aria-label={`${unreadCount} unread`}>{unreadCount}</span>
          )}
        </div>
        {!isScanned && !error && (
          <button
            className={`gmail-inbox-list__scan-btn${isScanning ? " gmail-inbox-list__scan-btn--loading" : ""}`}
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <span className="gmail-inbox-list__scan-spinner" />
                Scanning…
              </>
            ) : (
              "WaibScan"
            )}
          </button>
        )}
      </div>
      {error ? (
        <div className="gmail-inbox-list__error" role="alert">
          <p className="gmail-inbox-list__error-text">{error}</p>
        </div>
      ) : (
        <div
          className="gmail-inbox-list__cards"
          role="list"
          aria-label="Email messages — drag to reorder priority"
        >
          {displayOrder.map((childIdx, displayIdx) => (
            <DragItem
              key={childIdx}
              index={displayIdx}
              totalCount={childCount}
              dragSourceIndex={dragSourceIndex}
              dropTargetIndex={dropTargetIndex}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onMoveByKeyboard={handleMoveByKeyboard}
            >
              {childArray[childIdx]}
            </DragItem>
          ))}
        </div>
      )}
      {isTruncated && fullCount && (
        <p className="gmail-inbox-list__truncated">
          Showing {totalCount} of {fullCount} emails
        </p>
      )}
    </div>
  );
}
