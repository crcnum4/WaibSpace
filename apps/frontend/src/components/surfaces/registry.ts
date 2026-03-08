import type { SurfaceSpec, SurfaceAction } from "@waibspace/types";

export interface SurfaceProps {
  spec: SurfaceSpec;
  onAction: (action: SurfaceAction) => void;
  onInteraction: (interaction: string, target: string, context?: unknown) => void;
}

// For now, all surface types use GenericSurface as placeholder
// Real components will be built in P6-2
export const surfaceComponents: Record<
  string,
  React.ComponentType<SurfaceProps>
> = {};
