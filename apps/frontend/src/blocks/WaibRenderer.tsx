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

import { useCallback, useContext, useEffect, type ReactNode } from "react";
import type { ComponentBlock, ComponentEventAction } from "@waibspace/types";
import { ObservationCollectorProvider } from "./ObservationCollector";
import { BlockStateProvider, BlockStateContext } from "./BlockStateStore";
import { ObservationWrapper } from "./ObservationWrapper";
import { getBlockComponent } from "./registry";
import { registerPrimitiveBlocks, FallbackBlock } from "./components";

// ---------------------------------------------------------------------------
// WaibRenderer — top-level entry point
// ---------------------------------------------------------------------------

export interface WaibRendererProps {
  blocks: ComponentBlock[];
  send: (type: string, payload: unknown) => void;
}

export function WaibRenderer({ blocks, send }: WaibRendererProps) {
  useEffect(() => {
    registerPrimitiveBlocks();
  }, []);

  return (
    <ObservationCollectorProvider send={send}>
      <BlockStateProvider>
        {blocks.map((block) => (
          <BlockNode key={block.id} block={block} send={send} />
        ))}
      </BlockStateProvider>
    </ObservationCollectorProvider>
  );
}

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

  // Resolve registered component or fall back
  const Component = getBlockComponent(block.type) ?? FallbackBlock;

  // Recursively render children
  let childNodes: ReactNode = null;
  if (block.children && block.children.length > 0) {
    childNodes = block.children.map((child) => (
      <BlockNode key={child.id} block={child} send={send} />
    ));
  }

  return (
    <ObservationWrapper block={block} onExecuteAction={handleExecuteAction}>
      <Component block={block}>{childNodes}</Component>
    </ObservationWrapper>
  );
}
