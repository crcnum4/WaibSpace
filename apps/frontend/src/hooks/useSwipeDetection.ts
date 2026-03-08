import { useRef, useCallback } from "react";

interface TouchPoint {
  x: number;
  y: number;
}

export type SwipeDirection = "left" | "right" | "up" | "down";

export function useSwipeDetection(
  onSwipe: (direction: SwipeDirection) => void,
  threshold = 50,
) {
  const startRef = useRef<TouchPoint | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!startRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startRef.current.x;
      const deltaY = touch.clientY - startRef.current.y;

      startRef.current = null;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (absDeltaX < threshold && absDeltaY < threshold) return;

      if (absDeltaX > absDeltaY) {
        onSwipe(deltaX > 0 ? "right" : "left");
      } else {
        onSwipe(deltaY > 0 ? "down" : "up");
      }
    },
    [onSwipe, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
