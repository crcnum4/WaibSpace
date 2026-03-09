/**
 * surface-diff — Minimal diff algorithm for SurfaceSpec / ComponentBlock trees.
 *
 * Compares old and new surface layouts and determines which surfaces changed,
 * which were added/removed, and which blocks within a surface changed. This
 * allows the renderer to skip re-rendering surfaces whose data hasn't changed,
 * preserving component state (form inputs, scroll position, etc.).
 */

import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";
import type { ComposedLayout } from "@waibspace/ui-renderer-contract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurfaceDiffResult {
  /** Surfaces that are new (not in old layout) */
  added: string[];
  /** Surfaces that were removed (not in new layout) */
  removed: string[];
  /** Surfaces whose data or blocks changed */
  changed: string[];
  /** Surfaces that are identical — safe to skip re-render */
  unchanged: string[];
  /** New layout version (timestamp) */
  version: number;
  /** Previous layout version */
  previousVersion: number;
}

// ---------------------------------------------------------------------------
// Block-level deep equality
// ---------------------------------------------------------------------------

/**
 * Fast deep-equal for ComponentBlock trees. Returns true if the two block
 * trees are structurally identical (same ids, types, props, children).
 */
export function blocksEqual(
  a: ComponentBlock[] | undefined,
  b: ComponentBlock[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!blockEqual(a[i], b[i])) return false;
  }
  return true;
}

function blockEqual(a: ComponentBlock, b: ComponentBlock): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.type !== b.type) return false;
  if (!shallowObjectEqual(a.props, b.props)) return false;
  return blocksEqual(a.children, b.children);
}

/**
 * Shallow comparison of two plain objects. Handles primitive values and
 * falls back to JSON comparison for nested objects/arrays.
 */
function shallowObjectEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    const valA = a[key];
    const valB = b[key];
    if (valA === valB) continue;
    if (
      typeof valA !== typeof valB ||
      typeof valA !== "object" ||
      valA === null ||
      valB === null
    ) {
      return false;
    }
    // For nested objects/arrays, use JSON stringification as a last resort.
    // This is acceptable because block props are typically small.
    if (JSON.stringify(valA) !== JSON.stringify(valB)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Surface-level diff
// ---------------------------------------------------------------------------

/**
 * Compare two SurfaceSpec objects for equality. Checks surfaceType, title,
 * summary, priority, data (via JSON), actions, and affordances.
 */
export function surfaceSpecEqual(a: SurfaceSpec, b: SurfaceSpec): boolean {
  if (a === b) return true;
  if (a.surfaceId !== b.surfaceId) return false;
  if (a.surfaceType !== b.surfaceType) return false;
  if (a.title !== b.title) return false;
  if (a.summary !== b.summary) return false;
  if (a.priority !== b.priority) return false;
  if (a.confidence !== b.confidence) return false;

  // Data is the main payload — deep compare
  if (JSON.stringify(a.data) !== JSON.stringify(b.data)) return false;

  // Actions and affordances
  if (JSON.stringify(a.actions) !== JSON.stringify(b.actions)) return false;
  if (JSON.stringify(a.affordances) !== JSON.stringify(b.affordances))
    return false;

  return true;
}

// ---------------------------------------------------------------------------
// Layout diff
// ---------------------------------------------------------------------------

/**
 * Compute a minimal diff between two ComposedLayouts. Returns which surfaces
 * were added, removed, changed, or left unchanged.
 */
export function diffLayouts(
  oldLayout: ComposedLayout | null,
  newLayout: ComposedLayout,
): SurfaceDiffResult {
  const result: SurfaceDiffResult = {
    added: [],
    removed: [],
    changed: [],
    unchanged: [],
    version: newLayout.timestamp,
    previousVersion: oldLayout?.timestamp ?? 0,
  };

  if (!oldLayout) {
    // Everything is new
    result.added = newLayout.surfaces.map((s) => s.surfaceId);
    return result;
  }

  const oldMap = new Map<string, SurfaceSpec>();
  for (const s of oldLayout.surfaces) {
    oldMap.set(s.surfaceId, s);
  }

  const newIds = new Set<string>();

  for (const newSurface of newLayout.surfaces) {
    newIds.add(newSurface.surfaceId);
    const oldSurface = oldMap.get(newSurface.surfaceId);

    if (!oldSurface) {
      result.added.push(newSurface.surfaceId);
    } else if (surfaceSpecEqual(oldSurface, newSurface)) {
      result.unchanged.push(newSurface.surfaceId);
    } else {
      result.changed.push(newSurface.surfaceId);
    }
  }

  // Detect removals
  for (const oldId of oldMap.keys()) {
    if (!newIds.has(oldId)) {
      result.removed.push(oldId);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Staleness detection
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_MS = 30_000; // 30 seconds

/**
 * Returns true if the layout is considered stale based on its timestamp.
 */
export function isLayoutStale(
  layout: ComposedLayout,
  now: number = Date.now(),
): boolean {
  return now - layout.timestamp > STALE_THRESHOLD_MS;
}
