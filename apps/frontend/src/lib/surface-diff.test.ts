import { describe, it, expect } from "bun:test";
import {
  blocksEqual,
  surfaceSpecEqual,
  diffLayouts,
  isLayoutStale,
} from "./surface-diff";
import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";
import type { ComposedLayout } from "@waibspace/ui-renderer-contract";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<ComponentBlock> = {}): ComponentBlock {
  return {
    id: "block-1",
    type: "Text",
    props: { content: "hello" },
    ...overrides,
  };
}

function makeSurface(overrides: Partial<SurfaceSpec> = {}): SurfaceSpec {
  return {
    surfaceType: "inbox",
    surfaceId: "surface-1",
    title: "Inbox",
    priority: 1,
    data: { items: [] },
    actions: [],
    affordances: [],
    layoutHints: {},
    provenance: { sourceAgent: "test", timestamp: Date.now(), dataState: "raw" },
    confidence: 1.0,
    ...overrides,
  } as SurfaceSpec;
}

function makeLayout(
  surfaces: SurfaceSpec[],
  overrides: Partial<ComposedLayout> = {},
): ComposedLayout {
  return {
    surfaces,
    layout: surfaces.map((s, i) => ({
      surfaceId: s.surfaceId,
      position: i,
      width: "half",
      prominence: "standard",
    })),
    timestamp: Date.now(),
    traceId: "trace-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// blocksEqual
// ---------------------------------------------------------------------------

describe("blocksEqual", () => {
  it("returns true for identical block arrays", () => {
    const a = [makeBlock()];
    expect(blocksEqual(a, a)).toBe(true);
  });

  it("returns true for structurally equal blocks", () => {
    const a = [makeBlock({ id: "a", props: { content: "hi" } })];
    const b = [makeBlock({ id: "a", props: { content: "hi" } })];
    expect(blocksEqual(a, b)).toBe(true);
  });

  it("returns false when props differ", () => {
    const a = [makeBlock({ props: { content: "hi" } })];
    const b = [makeBlock({ props: { content: "bye" } })];
    expect(blocksEqual(a, b)).toBe(false);
  });

  it("returns false when ids differ", () => {
    const a = [makeBlock({ id: "a" })];
    const b = [makeBlock({ id: "b" })];
    expect(blocksEqual(a, b)).toBe(false);
  });

  it("returns false when length differs", () => {
    const a = [makeBlock()];
    const b = [makeBlock(), makeBlock({ id: "block-2" })];
    expect(blocksEqual(a, b)).toBe(false);
  });

  it("handles undefined arrays", () => {
    expect(blocksEqual(undefined, undefined)).toBe(true);
    expect(blocksEqual([], undefined)).toBe(false);
    expect(blocksEqual(undefined, [])).toBe(false);
  });

  it("compares children recursively", () => {
    const a = [
      makeBlock({
        children: [makeBlock({ id: "child-1", props: { content: "x" } })],
      }),
    ];
    const b = [
      makeBlock({
        children: [makeBlock({ id: "child-1", props: { content: "x" } })],
      }),
    ];
    expect(blocksEqual(a, b)).toBe(true);
  });

  it("detects child differences", () => {
    const a = [
      makeBlock({
        children: [makeBlock({ id: "child-1", props: { content: "x" } })],
      }),
    ];
    const b = [
      makeBlock({
        children: [makeBlock({ id: "child-1", props: { content: "y" } })],
      }),
    ];
    expect(blocksEqual(a, b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// surfaceSpecEqual
// ---------------------------------------------------------------------------

describe("surfaceSpecEqual", () => {
  it("returns true for identical specs", () => {
    const s = makeSurface();
    expect(surfaceSpecEqual(s, s)).toBe(true);
  });

  it("returns true for structurally equal specs", () => {
    const a = makeSurface({ data: { items: [1, 2] } });
    const b = makeSurface({ data: { items: [1, 2] } });
    expect(surfaceSpecEqual(a, b)).toBe(true);
  });

  it("returns false when data differs", () => {
    const a = makeSurface({ data: { items: [1] } });
    const b = makeSurface({ data: { items: [1, 2] } });
    expect(surfaceSpecEqual(a, b)).toBe(false);
  });

  it("returns false when title differs", () => {
    const a = makeSurface({ title: "A" });
    const b = makeSurface({ title: "B" });
    expect(surfaceSpecEqual(a, b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// diffLayouts
// ---------------------------------------------------------------------------

describe("diffLayouts", () => {
  it("marks all surfaces as added when no previous layout", () => {
    const s1 = makeSurface({ surfaceId: "s1" });
    const layout = makeLayout([s1]);
    const result = diffLayouts(null, layout);
    expect(result.added).toEqual(["s1"]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.unchanged).toEqual([]);
  });

  it("detects unchanged surfaces", () => {
    const s1 = makeSurface({ surfaceId: "s1", data: { x: 1 } });
    const oldLayout = makeLayout([s1]);
    const newLayout = makeLayout([s1]);
    const result = diffLayouts(oldLayout, newLayout);
    expect(result.unchanged).toEqual(["s1"]);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it("detects changed surfaces", () => {
    const s1Old = makeSurface({ surfaceId: "s1", data: { x: 1 } });
    const s1New = makeSurface({ surfaceId: "s1", data: { x: 2 } });
    const result = diffLayouts(makeLayout([s1Old]), makeLayout([s1New]));
    expect(result.changed).toEqual(["s1"]);
    expect(result.unchanged).toEqual([]);
  });

  it("detects added and removed surfaces", () => {
    const s1 = makeSurface({ surfaceId: "s1" });
    const s2 = makeSurface({ surfaceId: "s2" });
    const result = diffLayouts(makeLayout([s1]), makeLayout([s2]));
    expect(result.added).toEqual(["s2"]);
    expect(result.removed).toEqual(["s1"]);
  });

  it("handles mixed add/remove/change/unchanged", () => {
    const s1 = makeSurface({ surfaceId: "s1", data: { x: 1 } });
    const s2Old = makeSurface({ surfaceId: "s2", data: { y: 1 } });
    const s2New = makeSurface({ surfaceId: "s2", data: { y: 2 } });
    const s3 = makeSurface({ surfaceId: "s3" });

    const oldLayout = makeLayout([s1, s2Old]);
    const newLayout = makeLayout([s1, s2New, s3]);

    const result = diffLayouts(oldLayout, newLayout);
    expect(result.unchanged).toEqual(["s1"]);
    expect(result.changed).toEqual(["s2"]);
    expect(result.added).toEqual(["s3"]);
    expect(result.removed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isLayoutStale
// ---------------------------------------------------------------------------

describe("isLayoutStale", () => {
  it("returns false for recent layout", () => {
    const layout = makeLayout([], { timestamp: Date.now() });
    expect(isLayoutStale(layout)).toBe(false);
  });

  it("returns true for old layout", () => {
    const layout = makeLayout([], { timestamp: Date.now() - 60_000 });
    expect(isLayoutStale(layout)).toBe(true);
  });
});
