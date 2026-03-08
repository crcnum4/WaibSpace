import { useRef, useCallback } from "react";

export function useLongPress(onLongPress: () => void, duration = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onMouseDown = useCallback(() => {
    timerRef.current = setTimeout(() => {
      onLongPress();
      timerRef.current = null;
    }, duration);
  }, [onLongPress, duration]);

  const onTouchStart = useCallback(() => {
    timerRef.current = setTimeout(() => {
      onLongPress();
      timerRef.current = null;
    }, duration);
  }, [onLongPress, duration]);

  return {
    onMouseDown,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart,
    onTouchEnd: clear,
  };
}
