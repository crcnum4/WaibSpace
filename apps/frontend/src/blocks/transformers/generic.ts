import type { ComponentBlock, SurfaceSpec } from "@waibspace/types";

export function genericToBlocks(spec: SurfaceSpec): ComponentBlock[] {
  const sid = spec.surfaceId;

  return [
    {
      id: `${sid}-root`,
      type: "Container",
      props: {},
      children: [
        {
          id: `${sid}-header`,
          type: "Text",
          props: { content: spec.title, variant: "h3" },
        },
        {
          id: `${sid}-body`,
          type: "Text",
          props: {
            content: JSON.stringify(spec.data, null, 2),
            variant: "body",
          },
        },
      ],
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: spec.surfaceType,
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}
