import type { ComposedLayout } from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { surfaceComponents } from "./surfaces/registry";
import { GenericSurface } from "./surfaces/GenericSurface";

interface SurfaceRendererProps {
  layout: ComposedLayout | null;
  onAction: (action: SurfaceAction) => void;
  onInteraction: (
    interaction: string,
    target: string,
    surfaceId: string,
    surfaceType: string,
    context?: unknown,
  ) => void;
}

export function SurfaceRenderer({
  layout,
  onAction,
  onInteraction,
}: SurfaceRendererProps) {
  if (!layout || layout.surfaces.length === 0) {
    return <div className="surface-empty">No surfaces to display</div>;
  }

  return (
    <div className="surface-grid">
      {layout.surfaces.map((surface, index) => {
        const directive = layout.layout.find(
          (d) => d.surfaceId === surface.surfaceId,
        );
        const Component =
          surfaceComponents[surface.surfaceType] || GenericSurface;
        return (
          <div
            key={surface.surfaceId}
            className={`surface-cell ${directive?.width || "full"} ${directive?.prominence || "standard"}`}
            style={{ order: directive?.position ?? index }}
          >
            <Component
              spec={surface}
              onAction={onAction}
              onInteraction={(interaction, target, context) =>
                onInteraction(
                  interaction,
                  target,
                  surface.surfaceId,
                  surface.surfaceType,
                  context,
                )
              }
            />
          </div>
        );
      })}
    </div>
  );
}
