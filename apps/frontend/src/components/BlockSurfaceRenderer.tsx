/**
 * BlockSurfaceRenderer — Drop-in replacement for SurfaceRenderer
 *
 * Bridges the existing SurfaceRenderer interface (ComposedLayout + callbacks)
 * to the new WaibRenderer pipeline (ComponentBlock[] + send). Transforms
 * ComposedLayout into ComponentBlocks via surface transformers, then renders
 * through WaibRenderer while mapping observation/interaction events back to
 * the onInteraction/onAction callbacks that HomePage expects.
 */

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import type { ComposedLayout } from "@waibspace/ui-renderer-contract";
import type { SurfaceAction, ComponentBlock } from "@waibspace/types";
import { WaibRenderer } from "../blocks/WaibRenderer";
import { transformSurface } from "../blocks/transformers";
import { ErrorSurface } from "./ErrorSurface";

// ---------------------------------------------------------------------------
// Props — identical to SurfaceRenderer
// ---------------------------------------------------------------------------

interface BlockSurfaceRendererProps {
  layout: ComposedLayout | null;
  onAction: (action: SurfaceAction) => void;
  onInteraction: (
    interaction: string,
    target: string,
    surfaceId: string,
    surfaceType: string,
    context?: unknown,
  ) => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton blocks for loading state
// ---------------------------------------------------------------------------

function buildSkeletonBlocks(): ComponentBlock[] {
  return [
    {
      id: "skeleton-1",
      type: "Container",
      props: { className: "skeleton-surface" },
      children: [
        { id: "skel-line-1a", type: "Text", props: { content: "\u00A0", variant: "heading", className: "skeleton-line" } },
        { id: "skel-line-1b", type: "Text", props: { content: "\u00A0", className: "skeleton-line" } },
        { id: "skel-line-1c", type: "Text", props: { content: "\u00A0", className: "skeleton-line" } },
      ],
    },
    {
      id: "skeleton-2",
      type: "Container",
      props: { className: "skeleton-surface" },
      children: [
        { id: "skel-line-2a", type: "Text", props: { content: "\u00A0", variant: "heading", className: "skeleton-line" } },
        { id: "skel-line-2b", type: "Text", props: { content: "\u00A0", className: "skeleton-line" } },
        { id: "skel-line-2c", type: "Text", props: { content: "\u00A0", className: "skeleton-line" } },
      ],
    },
    {
      id: "skeleton-3",
      type: "Container",
      props: { className: "skeleton-surface" },
      children: [
        { id: "skel-line-3a", type: "Text", props: { content: "\u00A0", variant: "heading", className: "skeleton-line" } },
        { id: "skel-line-3b", type: "Text", props: { content: "\u00A0", className: "skeleton-line" } },
        { id: "skel-line-3c", type: "Text", props: { content: "\u00A0", className: "skeleton-line" } },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BlockSurfaceRenderer({
  layout,
  onAction,
  onInteraction,
  isLoading,
}: BlockSurfaceRendererProps) {
  // Transform ComposedLayout into ComponentBlock[] per surface
  const surfaceBlocks = useMemo<
    Array<{ blocks: ComponentBlock[]; width: string; prominence: string; surfaceId: string; position: number }>
  >(() => {
    if (!layout || layout.surfaces.length === 0) return [];
    const directiveMap = new Map(
      layout.layout.map((d) => [d.surfaceId, d]),
    );
    return layout.surfaces.map((spec, index) => {
      const directive = directiveMap.get(spec.surfaceId);
      const blocks = transformSurface(spec);
      if (import.meta.env.DEV) {
        console.log(`[BlockRenderer] ${spec.surfaceType}/${spec.surfaceId}`, blocks);
      }
      return {
        blocks,
        width: directive?.width ?? "full",
        prominence: directive?.prominence ?? "standard",
        surfaceId: spec.surfaceId,
        position: directive?.position ?? index,
      };
    });
  }, [layout]);

  // Progressive reveal animation
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const prevSurfaceIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!layout) return;
    const currentIds = layout.surfaces.map((s) => s.surfaceId);
    const prevIds = prevSurfaceIdsRef.current;
    const newIds = currentIds.filter((id) => !prevIds.includes(id));
    if (newIds.length > 0) {
      newIds.forEach((id, i) => {
        setTimeout(() => {
          setRevealedIds((prev) => new Set([...prev, id]));
        }, i * 150);
      });
    }
    prevSurfaceIdsRef.current = currentIds;
  }, [layout]);

  // Bridge send function: maps WaibRenderer events back to
  // the onInteraction / onAction callbacks that HomePage uses.
  const send = useCallback(
    (type: string, payload: unknown) => {
      if (type !== "user.interaction") return;

      const data = payload as Record<string, unknown>;

      // Observation batches from ObservationCollector — forward as-is
      if (data.batch) return;

      const interaction = (data.interaction as string) ?? "";

      // Try to resolve surfaceId/surfaceType from the payload context
      const surfaceId = (data.surfaceId as string) ?? "";
      const surfaceType = (data.surfaceType as string) ?? "";
      const target = (data.target as string) ?? (data.blockId as string) ?? "";

      // Approval interactions (approve/deny) get routed with surfaceType="approval"
      if (
        interaction === "approve" ||
        interaction === "deny" ||
        interaction === "approval.approve" ||
        interaction === "approval.deny"
      ) {
        onInteraction(
          interaction,
          target,
          surfaceId,
          "approval",
          data.context ?? data.payload,
        );
        return;
      }

      // Action button clicks: payload should contain the SurfaceAction shape
      if (interaction === "action" && data.action) {
        onAction(data.action as SurfaceAction);
        return;
      }

      // Default: forward as an interaction event
      onInteraction(interaction, target, surfaceId, surfaceType, data.context ?? data.payload);
    },
    [onAction, onInteraction],
  );

  // Loading state: show skeleton blocks
  if (isLoading && (!layout || layout.surfaces.length === 0)) {
    return (
      <div className="surface-grid">
        <WaibRenderer blocks={buildSkeletonBlocks()} send={send} />
      </div>
    );
  }

  // Empty state with errors
  if (!layout || layout.surfaces.length === 0) {
    if (layout?.errors && layout.errors.length > 0) {
      return (
        <div className="surface-grid">
          <div className="surface-cell full">
            <ErrorSurface errors={layout.errors} />
          </div>
        </div>
      );
    }
    return <div className="surface-empty">No surfaces to display</div>;
  }

  const hasErrors = (layout.errors?.length ?? 0) > 0;

  return (
    <div className="surface-grid">
      {hasErrors && layout.errors && (
        <div className="surface-cell full">
          <ErrorSurface errors={layout.errors} />
        </div>
      )}
      {surfaceBlocks.map((surface) => {
        const isRevealed = revealedIds.has(surface.surfaceId);
        return (
          <div
            key={surface.surfaceId}
            className={`surface-cell ${surface.width} ${surface.prominence} ${isRevealed ? "surface-revealed" : "surface-entering"}`}
            style={{ order: surface.position }}
          >
            <div className="surface-wrapper">
              <div className="surface">
                <WaibRenderer blocks={surface.blocks} send={send} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
