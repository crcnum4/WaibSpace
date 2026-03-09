import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type {
  ComponentBlock,
  ComponentEventAction,
  InteractionType,
  Observation,
} from "@waibspace/types";
import { useObservationCollector } from "./ObservationCollector";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ObservationWrapperProps {
  block: ComponentBlock;
  onExecuteAction?: (action: ComponentEventAction) => void;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObservationWrapper({
  block,
  onExecuteAction,
  children,
}: ObservationWrapperProps) {
  const { record, registerIntersectionTarget } = useObservationCollector();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Mutable tracking refs — never cause re-renders
  const hoverStartRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragRecordedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const makeObservation = useCallback(
    (
      interactionType: InteractionType,
      wasPlanned: boolean,
      extra?: Partial<Observation>,
    ): Observation => ({
      blockId: block.id,
      blockType: block.type,
      wasPlanned,
      interactionType,
      timestamp: Date.now(),
      ...extra,
    }),
    [block.id, block.type],
  );

  const executeIfPlanned = useCallback(
    (
      interactionType: InteractionType,
      plannedAction: ComponentEventAction | undefined,
      extra?: Partial<Observation>,
    ) => {
      if (plannedAction) {
        onExecuteAction?.(plannedAction);
        record(makeObservation(interactionType, true, extra));
      } else {
        record(makeObservation(interactionType, false, extra));
      }
    },
    [onExecuteAction, record, makeObservation],
  );

  // -------------------------------------------------------------------------
  // 1. Click
  // -------------------------------------------------------------------------

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const position = { x: e.clientX, y: e.clientY };
      executeIfPlanned("click", block.events?.onClick, { position });
    },
    [block.events?.onClick, executeIfPlanned],
  );

  // -------------------------------------------------------------------------
  // 2. Double-click
  // -------------------------------------------------------------------------

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const position = { x: e.clientX, y: e.clientY };
      executeIfPlanned("double-click", block.events?.onDoubleClick, {
        position,
      });
    },
    [block.events?.onDoubleClick, executeIfPlanned],
  );

  // -------------------------------------------------------------------------
  // 3. Right-click
  // -------------------------------------------------------------------------

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const planned = block.events?.onClick; // right-click doesn't have its own event key
      // Use onClick as a fallback check — but right-click is always unplanned
      // per the block events schema (no onRightClick field).
      // However, for the dual-execution pattern we treat any context menu
      // interaction as unplanned since ComponentBlockEvents has no onRightClick.
      // The requirement says "check block.events?.onDoubleClick" style — but
      // there is no onRightClick in the schema. We'll record as unplanned.
      // Actually re-reading the requirement: right-click should check for a
      // planned handler. The schema doesn't have onRightClick but the requirement
      // says "If planned, prevent default and execute." Since there's no field
      // in the events interface, right-click is always unplanned.
      void planned; // suppress lint
      if (block.events && "onRightClick" in block.events) {
        e.preventDefault();
        onExecuteAction?.(
          (block.events as Record<string, ComponentEventAction>)[
            "onRightClick"
          ],
        );
        record(makeObservation("right-click", true));
      } else {
        record(makeObservation("right-click", false));
      }
    },
    [block.events, onExecuteAction, record, makeObservation],
  );

  // -------------------------------------------------------------------------
  // 4. Hover (mouse enter / leave with dwell time)
  // -------------------------------------------------------------------------

  const handleMouseEnter = useCallback(() => {
    hoverStartRef.current = Date.now();
  }, []);

  const handleMouseLeave = useCallback(() => {
    const dwellMs = Date.now() - hoverStartRef.current;
    hoverStartRef.current = 0;
    executeIfPlanned("hover", block.events?.onHover, { dwellMs });
  }, [block.events?.onHover, executeIfPlanned]);

  // -------------------------------------------------------------------------
  // 5. Long-press (500ms pointer hold)
  // -------------------------------------------------------------------------

  const handlePointerDown = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      executeIfPlanned("long-press", block.events?.onLongPress);
    }, LONG_PRESS_MS);
  }, [block.events?.onLongPress, executeIfPlanned]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // 6. Drag-attempt (mouse moves > 5px on a non-draggable element)
  // -------------------------------------------------------------------------

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragRecordedRef.current = false;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStartRef.current || dragRecordedRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
        const target = e.target as HTMLElement;
        if (!target.draggable) {
          dragRecordedRef.current = true;
          executeIfPlanned("drag-attempt", block.events?.onDragStart);
        }
      }
    },
    [block.events?.onDragStart, executeIfPlanned],
  );

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null;
    dragRecordedRef.current = false;
  }, []);

  // -------------------------------------------------------------------------
  // 7. Scroll-view (IntersectionObserver via ObservationCollector)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const cleanup = registerIntersectionTarget(el, block.id, block.type);
    return cleanup;
  }, [block.id, block.type, registerIntersectionTarget]);

  // -------------------------------------------------------------------------
  // Cleanup long-press timer on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={wrapperRef}
      data-block-id={block.id}
      data-block-type={block.type}
      style={{ display: "contents" }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {children}
    </div>
  );
}
