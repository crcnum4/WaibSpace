/**
 * WaibRenderer — Recursive Block Compiler
 *
 * Top-level component that takes a tree of ComponentBlocks and compiles them
 * into a living React UI. Each block is wrapped in an ObservationWrapper for
 * interaction capture, resolved from the registry, and recursively rendered.
 *
 * Architecture:
 *   WaibRenderer
 *     └─ ObservationCollectorProvider (batching context, receives send fn)
 *         └─ BlockStateProvider (shared state)
 *             └─ BlockNode (per block, recursive)
 *                 └─ ObservationWrapper (captures all interactions)
 *                     └─ RegisteredComponent (from registry)
 *                         └─ children BlockNodes (recursive)
 */

import { memo, useCallback, useContext, type ReactNode } from "react";
import type { ComponentBlock, ComponentEventAction } from "@waibspace/types";
import { ObservationCollectorProvider } from "./ObservationCollector";
import { BlockStateProvider, BlockStateContext } from "./BlockStateStore";
import { ObservationWrapper } from "./ObservationWrapper";
import { getBlockComponent } from "./registry";
import { FallbackBlock } from "./components";
import { BlockErrorBoundary } from "../components/BlockErrorBoundary";

// ---------------------------------------------------------------------------
// WaibRenderer — top-level entry point
// ---------------------------------------------------------------------------

export interface WaibRendererProps {
  blocks: ComponentBlock[];
  send: (type: string, payload: unknown) => void;
}

export const WaibRenderer = memo(function WaibRenderer({ blocks, send }: WaibRendererProps) {
  return (
    <ObservationCollectorProvider send={send}>
      <BlockStateProvider>
        {blocks.map((block) => (
          <MemoizedBlockNode key={block.id} block={block} send={send} />
        ))}
      </BlockStateProvider>
    </ObservationCollectorProvider>
  );
});

// ---------------------------------------------------------------------------
// BlockNode — per-block recursive renderer
// ---------------------------------------------------------------------------

interface BlockNodeProps {
  block: ComponentBlock;
  send: (type: string, payload: unknown) => void;
}

function BlockNode({ block, send }: BlockNodeProps) {
  const stateCtx = useContext(BlockStateContext);

  const executeAction = useCallback(
    async (action: ComponentEventAction): Promise<void> => {
      switch (action.action) {
        case "setState": {
          stateCtx?.setState(action.key, action.value);
          if (action.then) await executeAction(action.then);
          break;
        }
        case "emit": {
          send("user.interaction", {
            interaction: action.event,
            ...((action.payload as Record<string, unknown>) ?? {}),
          });
          if (action.then) await executeAction(action.then);
          break;
        }
        case "navigate": {
          window.location.href = action.path;
          if (action.then) await executeAction(action.then);
          break;
        }
        case "fetch": {
          await fetch(action.url, {
            method: action.method ?? "GET",
            ...(action.body != null
              ? {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(action.body),
                }
              : {}),
          });
          if (action.then) await executeAction(action.then);
          break;
        }
        case "sequence": {
          for (const step of action.steps) {
            await executeAction(step);
          }
          break;
        }
      }
    },
    [stateCtx, send],
  );

  const handleExecuteAction = useCallback(
    (action: ComponentEventAction) => {
      void executeAction(action);
    },
    [executeAction],
  );

  /**
   * onEvent callback for domain components (e.g. InboxList's WaibScan button).
   * Bridges the BlockProps.onEvent API to the WebSocket event bus so domain
   * components can emit named events without needing to define emit actions.
   */
  const handleEvent = useCallback(
    (eventName: string, payload?: unknown) => {
      send("user.interaction", {
        interaction: eventName,
        blockId: block.id,
        blockType: block.type,
        ...((payload != null && typeof payload === "object") ? payload as Record<string, unknown> : {}),
      });
    },
    [send, block.id, block.type],
  );

  // Resolve registered component or fall back
  const Component = getBlockComponent(block.type) ?? FallbackBlock;

  // Recursively render children
  let childNodes: ReactNode = null;
  if (block.children && block.children.length > 0) {
    childNodes = block.children.map((child) => (
      <MemoizedBlockNode key={child.id} block={child} send={send} />
    ));
  }

  return (
    <BlockErrorBoundary blockId={block.id}>
      <ObservationWrapper block={block} onExecuteAction={handleExecuteAction}>
        <Component block={block} onEvent={handleEvent}>{childNodes}</Component>
      </ObservationWrapper>
    </BlockErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// MemoizedBlockNode — skips re-render when block reference is stable
// ---------------------------------------------------------------------------

const MemoizedBlockNode = memo(BlockNode, (prev, next) => {
  // If the block object reference is the same, skip re-render
  if (prev.block === next.block && prev.send === next.send) return true;
  // If the block id/type/props are identical, skip re-render
  if (prev.block.id !== next.block.id) return false;
  if (prev.block.type !== next.block.type) return false;
  if (prev.send !== next.send) return false;
  // For prop equality, rely on reference equality (which we guarantee via
  // the useSurfaceDiff hook returning stable block references for unchanged
  // surfaces).
  return prev.block === next.block;
});
