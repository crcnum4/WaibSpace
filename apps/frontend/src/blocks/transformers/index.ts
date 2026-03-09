import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";
import type { ComposedLayout } from "@waibspace/ui-renderer-contract";

import { inboxToBlocks } from "./inbox";
import { calendarToBlocks } from "./calendar";
import { discoveryToBlocks } from "./discovery";
import { approvalToBlocks } from "./approval";
import { connectionGuideToBlocks } from "./connection-guide";
import { genericToBlocks } from "./generic";

export {
  inboxToBlocks,
  calendarToBlocks,
  discoveryToBlocks,
  approvalToBlocks,
  connectionGuideToBlocks,
  genericToBlocks,
};

const transformerMap: Record<
  string,
  (spec: SurfaceSpec) => ComponentBlock[]
> = {
  inbox: inboxToBlocks,
  calendar: calendarToBlocks,
  discovery: discoveryToBlocks,
  approval: approvalToBlocks,
  "connection-guide": connectionGuideToBlocks,
};

/**
 * Route a SurfaceSpec to the appropriate per-type transformer.
 * Falls back to genericToBlocks for unknown surface types.
 */
export function transformSurface(spec: SurfaceSpec): ComponentBlock[] {
  const transformer = transformerMap[spec.surfaceType];
  return transformer ? transformer(spec) : genericToBlocks(spec);
}

/**
 * Transform all surfaces in a ComposedLayout into ComponentBlock[].
 * Each surface's blocks are wrapped in a Container that carries
 * the LayoutDirective metadata (width, prominence).
 */
export function composedLayoutToBlocks(
  layout: ComposedLayout,
): ComponentBlock[] {
  const directiveMap = new Map(
    layout.layout.map((d) => [d.surfaceId, d]),
  );

  return layout.surfaces.map((spec) => {
    const blocks = transformSurface(spec);
    const directive = directiveMap.get(spec.surfaceId);

    // Wrap each surface's blocks in a layout container
    return {
      id: `layout-${spec.surfaceId}`,
      type: "Container",
      props: {},
      children: blocks,
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: spec.surfaceType,
        layoutHints: directive
          ? {
              width: directive.width as
                | "full"
                | "half"
                | "third"
                | "auto",
              prominence: directive.prominence as
                | "hero"
                | "standard"
                | "compact"
                | "minimal",
            }
          : spec.layoutHints,
      },
    };
  });
}
