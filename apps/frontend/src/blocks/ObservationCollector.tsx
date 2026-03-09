import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Observation } from "@waibspace/types";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ObservationCollectorContextValue {
  /** Queue a single observation for batched delivery */
  record: (observation: Observation) => void;
  /**
   * Register an element for shared IntersectionObserver tracking.
   * Returns a cleanup function that unobserves the element.
   */
  registerIntersectionTarget: (
    element: HTMLElement,
    blockId: string,
    blockType: string,
  ) => () => void;
}

const ObservationCollectorContext =
  createContext<ObservationCollectorContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const FLUSH_INTERVAL_MS = 2_000;
const FLUSH_THRESHOLD = 50;
const INTERSECTION_THRESHOLDS = [0, 0.5, 1.0];

interface ObservationCollectorProviderProps {
  /** WebSocket send function */
  send: (type: string, payload: unknown) => void;
  children: ReactNode;
}

export function ObservationCollectorProvider({
  send,
  children,
}: ObservationCollectorProviderProps) {
  const bufferRef = useRef<Observation[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  // Track which elements have already triggered a scroll-view observation
  // so we only fire once per element.
  const viewedElementsRef = useRef<WeakSet<Element>>(new WeakSet());

  // Map observed elements to their block metadata for IntersectionObserver
  const elementMetaRef = useRef<
    Map<Element, { blockId: string; blockType: string }>
  >(new Map());

  // -----------------------------------------------------------------------
  // Flush logic
  // -----------------------------------------------------------------------

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const observations = bufferRef.current;
    bufferRef.current = [];
    sendRef.current("user.interaction", {
      batch: observations,
      sessionId: sessionIdRef.current,
      batchTimestamp: Date.now(),
    });
  }, []);

  // -----------------------------------------------------------------------
  // Record — add observation and flush if threshold reached
  // -----------------------------------------------------------------------

  const record = useCallback(
    (observation: Observation) => {
      bufferRef.current.push(observation);
      if (bufferRef.current.length >= FLUSH_THRESHOLD) {
        flush();
      }
    },
    [flush],
  );

  // -----------------------------------------------------------------------
  // Shared IntersectionObserver
  // -----------------------------------------------------------------------

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Lazily create the observer so it exists for the lifetime of the provider
  const getObserver = useCallback((): IntersectionObserver => {
    if (observerRef.current) return observerRef.current;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Only fire when crossing 0.5 threshold going *up*
          if (
            entry.intersectionRatio >= 0.5 &&
            !viewedElementsRef.current.has(entry.target)
          ) {
            viewedElementsRef.current.add(entry.target);
            const meta = elementMetaRef.current.get(entry.target);
            if (meta) {
              record({
                blockId: meta.blockId,
                blockType: meta.blockType,
                wasPlanned: false,
                interactionType: "scroll-view",
                viewportRatio: entry.intersectionRatio,
                timestamp: Date.now(),
              });
            }
          }
        }
      },
      { threshold: INTERSECTION_THRESHOLDS },
    );

    return observerRef.current;
  }, [record]);

  const registerIntersectionTarget = useCallback(
    (element: HTMLElement, blockId: string, blockType: string): (() => void) => {
      const observer = getObserver();
      elementMetaRef.current.set(element, { blockId, blockType });
      observer.observe(element);

      return () => {
        observer.unobserve(element);
        elementMetaRef.current.delete(element);
      };
    },
    [getObserver],
  );

  // -----------------------------------------------------------------------
  // Lifecycle: timer, visibility, cleanup
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Periodic flush
    timerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);

    // Flush on visibility hidden (tab close / switch)
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Flush remaining on unmount
      flush();
      // Disconnect intersection observer
      observerRef.current?.disconnect();
    };
  }, [flush]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <ObservationCollectorContext.Provider
      value={{ record, registerIntersectionTarget }}
    >
      {children}
    </ObservationCollectorContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useObservationCollector(): ObservationCollectorContextValue {
  const ctx = useContext(ObservationCollectorContext);
  if (!ctx) {
    throw new Error(
      "useObservationCollector must be used within an ObservationCollectorProvider",
    );
  }
  return ctx;
}
