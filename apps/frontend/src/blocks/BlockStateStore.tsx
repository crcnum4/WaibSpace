/**
 * BlockStateStore — Tier 2 shared block state.
 *
 * Provides a lightweight, per-layout shared state store that blocks can
 * read and write via `useBlockState(key)`.  Internally the store is a
 * `Map<string, unknown>` held in a ref.  Subscriptions are per-key so
 * mutations only re-render the components that care about the changed key.
 *
 * Uses React's built-in `useSyncExternalStore` for tear-free reads.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Store internals
// ---------------------------------------------------------------------------

type Listener = () => void;

interface BlockStateStore {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  subscribe(key: string, listener: Listener): () => void;
  getSnapshot(key: string): unknown;
}

function createBlockStateStore(): BlockStateStore {
  const data = new Map<string, unknown>();
  const listeners = new Map<string, Set<Listener>>();

  function notify(key: string) {
    const subs = listeners.get(key);
    if (subs) {
      for (const listener of subs) {
        listener();
      }
    }
  }

  return {
    getState(key: string): unknown {
      return data.get(key);
    },

    setState(key: string, value: unknown): void {
      const prev = data.get(key);
      if (Object.is(prev, value)) return; // no-op when unchanged
      data.set(key, value);
      notify(key);
    },

    subscribe(key: string, listener: Listener): () => void {
      let subs = listeners.get(key);
      if (!subs) {
        subs = new Set();
        listeners.set(key, subs);
      }
      subs.add(listener);
      return () => {
        subs!.delete(listener);
        if (subs!.size === 0) {
          listeners.delete(key);
        }
      };
    },

    getSnapshot(key: string): unknown {
      return data.get(key);
    },
  };
}

// ---------------------------------------------------------------------------
// React Context
// ---------------------------------------------------------------------------

interface BlockStateContextValue {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  /** @internal — used by useBlockState */
  _store: BlockStateStore;
}

const BlockStateContext = createContext<BlockStateContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface BlockStateProviderProps {
  children: ReactNode;
}

export function BlockStateProvider({ children }: BlockStateProviderProps) {
  const storeRef = useRef<BlockStateStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createBlockStateStore();
  }
  const store = storeRef.current;

  const ctxValue: BlockStateContextValue = {
    getState: store.getState,
    setState: store.setState,
    _store: store,
  };

  return (
    <BlockStateContext.Provider value={ctxValue}>
      {children}
    </BlockStateContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook — fine-grained subscription to a single key
// ---------------------------------------------------------------------------

/**
 * Subscribe to a specific key in the shared block state store.
 *
 * Returns `[value, setValue]` similar to `useState`, but backed by the
 * shared store so sibling blocks can coordinate through it.
 *
 * Only re-renders when the subscribed key changes.
 */
export function useBlockState(key: string): [unknown, (value: unknown) => void] {
  const ctx = useContext(BlockStateContext);
  if (!ctx) {
    throw new Error("useBlockState must be used within a <BlockStateProvider>");
  }

  const { _store: store } = ctx;

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(key, onStoreChange),
    [store, key],
  );

  const getSnapshot = useCallback(() => store.getSnapshot(key), [store, key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: unknown) => store.setState(key, next),
    [store, key],
  );

  return [value, setValue];
}

export { BlockStateContext };
