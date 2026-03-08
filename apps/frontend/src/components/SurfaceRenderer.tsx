import { useEffect, useRef, useState } from "react";
import type { ComposedLayout } from "@waibspace/ui-renderer-contract";
import type { SurfaceAction } from "@waibspace/types";
import { surfaceComponents } from "./surfaces/registry";
import { GenericSurface } from "./surfaces/GenericSurface";
import { SkeletonSurface } from "./surfaces/SkeletonSurface";
import { ErrorSurface } from "./ErrorSurface";
import { StaleIndicator } from "./StaleIndicator";

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
  isLoading?: boolean;
}

/** Track which surface IDs have already been revealed so we can animate new ones in. */
export function SurfaceRenderer({
  layout,
  onAction,
  onInteraction,
  isLoading,
}: SurfaceRendererProps) {
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const prevSurfaceIdsRef = useRef<string[]>([]);

  // Progressive reveal: stagger new surfaces as they arrive
  useEffect(() => {
    if (!layout) return;

    const currentIds = layout.surfaces.map((s) => s.surfaceId);
    const prevIds = prevSurfaceIdsRef.current;
    const newIds = currentIds.filter((id) => !prevIds.includes(id));

    if (newIds.length > 0) {
      // Stagger reveals with a small delay between each
      newIds.forEach((id, i) => {
        setTimeout(() => {
          setRevealedIds((prev) => new Set([...prev, id]));
        }, i * 150);
      });
    }

    prevSurfaceIdsRef.current = currentIds;
  }, [layout]);

  // Show skeletons while loading and no surfaces exist
  if (isLoading && (!layout || layout.surfaces.length === 0)) {
    return (
      <div className="surface-grid">
        {(["inbox", "calendar", "discovery"] as const).map((type, i) => (
          <div
            key={`skeleton-${type}`}
            className="surface-cell full surface-appear"
            style={{
              order: i,
              animationDelay: `${i * 200}ms`,
            }}
          >
            <SkeletonSurface type={type} />
          </div>
        ))}
      </div>
    );
  }

  if (!layout || layout.surfaces.length === 0) {
    // If there are errors but no surfaces, show the error surface
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
      {layout.surfaces.map((surface, index) => {
        const directive = layout.layout.find(
          (d) => d.surfaceId === surface.surfaceId,
        );
        const Component =
          surfaceComponents[surface.surfaceType] || GenericSurface;
        const isRevealed = revealedIds.has(surface.surfaceId);

        return (
          <div
            key={surface.surfaceId}
            className={`surface-cell ${directive?.width || "full"} ${directive?.prominence || "standard"} ${isRevealed ? "surface-revealed" : "surface-entering"}`}
            style={{ order: directive?.position ?? index }}
          >
            <div className="surface-wrapper">
              {hasErrors && (
                <StaleIndicator
                  timestamp={layout.timestamp}
                  hasErrors={hasErrors}
                />
              )}
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
          </div>
        );
      })}
    </div>
  );
}
