/**
 * Block Component Registry
 *
 * Central registry mapping block type strings to their React component
 * implementations and registration metadata. Tool bundles and built-in
 * primitives both register through this module so the WaibRenderer can
 * resolve any ComponentBlock.type to a concrete component at render time.
 */

import type { ComponentBlock, BlockRegistration } from "@waibspace/types";

// ---------------------------------------------------------------------------
// BlockProps — The standard prop contract every block component receives
// ---------------------------------------------------------------------------

export interface BlockProps {
  /** The ComponentBlock descriptor being rendered */
  block: ComponentBlock;
  /** Nested child elements (from recursive block tree rendering) */
  children?: React.ReactNode;
  /** Callback for emitting named events back to the orchestration layer */
  onEvent?: (eventName: string, payload?: unknown) => void;
}

// ---------------------------------------------------------------------------
// Internal registry store
// ---------------------------------------------------------------------------

interface RegistryEntry {
  component: React.ComponentType<BlockProps>;
  registration: BlockRegistration;
}

const registry = new Map<string, RegistryEntry>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a single block component by type.
 *
 * @param type - Block type identifier (e.g. "Container", "WeatherCard")
 * @param component - React component that renders this block type
 * @param registration - Metadata describing the block's category and origin
 */
export function registerBlock(
  type: string,
  component: React.ComponentType<BlockProps>,
  registration: BlockRegistration,
): void {
  registry.set(type, { component, registration });
}

/**
 * Batch-register multiple block components at once.
 * Useful for tool bundles that ship several related block types.
 *
 * @param entries - Array of { type, component, registration } objects
 */
export function registerBlocks(
  entries: Array<{
    type: string;
    component: React.ComponentType<BlockProps>;
    registration: BlockRegistration;
  }>,
): void {
  for (const entry of entries) {
    registerBlock(entry.type, entry.component, entry.registration);
  }
}

/**
 * Look up the React component for a given block type.
 *
 * @returns The component, or `undefined` if the type is not registered.
 */
export function getBlockComponent(
  type: string,
): React.ComponentType<BlockProps> | undefined {
  return registry.get(type)?.component;
}

/**
 * Look up the registration metadata for a given block type.
 *
 * @returns The BlockRegistration, or `undefined` if the type is not registered.
 */
export function getBlockRegistration(
  type: string,
): BlockRegistration | undefined {
  return registry.get(type)?.registration;
}

/**
 * List every registered block's metadata.
 *
 * @returns An array of all BlockRegistration entries currently in the registry.
 */
export function listRegisteredBlocks(): BlockRegistration[] {
  return Array.from(registry.values()).map((entry) => entry.registration);
}
