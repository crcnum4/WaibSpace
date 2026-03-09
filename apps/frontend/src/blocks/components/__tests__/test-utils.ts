import type { ComponentBlock } from "@waibspace/types";

/**
 * Create a ComponentBlock with the given type and props for testing.
 * Provides sensible defaults for the required `id` and `type` fields.
 */
export function makeBlock(
  type: string,
  props: Record<string, unknown>,
  children?: ComponentBlock[],
): ComponentBlock {
  return {
    id: `test-${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    props,
    ...(children ? { children } : {}),
  };
}

/**
 * No-op event handler for tests that don't care about events.
 */
export const noopEvent = () => {};
