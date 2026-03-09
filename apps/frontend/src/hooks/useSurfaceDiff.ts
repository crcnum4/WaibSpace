/**
 * useSurfaceDiff — React hook for surface-level diffing.
 *
 * Tracks the previous ComposedLayout and computes a diff against the new one.
 * Returns the diff result plus a stable map of transformed blocks, only
 * recomputing blocks for surfaces that actually changed.
 */

import { useRef, useMemo } from "react";
import type { ComposedLayout } from "@waibspace/ui-renderer-contract";
import type { ComponentBlock } from "@waibspace/types";
import { diffLayouts, type SurfaceDiffResult } from "../lib/surface-diff";
import { transformSurface } from "../blocks/transformers";

export interface SurfaceEntry {
  blocks: ComponentBlock[];
  width: string;
  prominence: string;
  surfaceId: string;
  position: number;
  /** Monotonic version counter — increments only when the surface data changes */
  version: number;
}

interface DiffState {
  /** The previous layout (for diffing against the next update) */
  previousLayout: ComposedLayout | null;
  /** Cached transformed blocks keyed by surfaceId */
  cache: Map<string, SurfaceEntry>;
  /** Per-surface version counter */
  versions: Map<string, number>;
}

export interface UseSurfaceDiffResult {
  /** Surface entries with stable block references for unchanged surfaces */
  surfaces: SurfaceEntry[];
  /** The diff result from comparing old layout to new layout */
  diff: SurfaceDiffResult | null;
}

/**
 * Given a ComposedLayout, returns surface entries where unchanged surfaces
 * retain their previous block references (enabling React.memo to skip
 * re-rendering them).
 */
export function useSurfaceDiff(
  layout: ComposedLayout | null,
): UseSurfaceDiffResult {
  const stateRef = useRef<DiffState>({
    previousLayout: null,
    cache: new Map(),
    versions: new Map(),
  });

  const result = useMemo<UseSurfaceDiffResult>(() => {
    if (!layout || layout.surfaces.length === 0) {
      return { surfaces: [], diff: null };
    }

    const state = stateRef.current;
    const diff = diffLayouts(state.previousLayout, layout);

    const directiveMap = new Map(
      layout.layout.map((d) => [d.surfaceId, d]),
    );

    const newCache = new Map<string, SurfaceEntry>();

    for (let index = 0; index < layout.surfaces.length; index++) {
      const spec = layout.surfaces[index];
      const directive = directiveMap.get(spec.surfaceId);
      const surfaceId = spec.surfaceId;

      if (diff.unchanged.includes(surfaceId) && state.cache.has(surfaceId)) {
        // Surface data is identical — reuse the cached blocks reference.
        // Only update layout-level props (position/width) which are cheap.
        const cached = state.cache.get(surfaceId)!;
        const entry: SurfaceEntry = {
          ...cached,
          width: directive?.width ?? "full",
          prominence: directive?.prominence ?? "standard",
          position: directive?.position ?? index,
        };
        newCache.set(surfaceId, entry);
      } else {
        // Surface is new or changed — recompute blocks
        const blocks = transformSurface(spec);
        const prevVersion = state.versions.get(surfaceId) ?? 0;
        const version = prevVersion + 1;
        state.versions.set(surfaceId, version);

        if (import.meta.env.DEV) {
          const reason = diff.added.includes(surfaceId) ? "added" : "changed";
          console.log(
            `[SurfaceDiff] ${reason}: ${spec.surfaceType}/${surfaceId} (v${version})`,
            blocks,
          );
        }

        const entry: SurfaceEntry = {
          blocks,
          width: directive?.width ?? "full",
          prominence: directive?.prominence ?? "standard",
          surfaceId,
          position: directive?.position ?? index,
          version,
        };
        newCache.set(surfaceId, entry);
      }
    }

    // Update state for next diff cycle
    state.previousLayout = layout;
    state.cache = newCache;

    // Return entries in layout order
    const surfaces = layout.surfaces
      .map((spec) => newCache.get(spec.surfaceId)!)
      .filter(Boolean);

    return { surfaces, diff };
  }, [layout]);

  return result;
}
