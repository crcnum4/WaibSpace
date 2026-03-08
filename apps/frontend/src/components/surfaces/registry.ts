import type { SurfaceSpec, SurfaceAction } from "@waibspace/types";
import { InboxSurface } from "./InboxSurface";
import { CalendarSurface } from "./CalendarSurface";
import { DiscoverySurface } from "./DiscoverySurface";
import { ApprovalSurface } from "./ApprovalSurface";
import { GenericSurface } from "./GenericSurface";
import { ConnectionGuideSurface } from "./ConnectionGuideSurface";

export interface SurfaceProps {
  spec: SurfaceSpec;
  onAction: (action: SurfaceAction) => void;
  onInteraction: (interaction: string, target: string, context?: unknown) => void;
}

export const surfaceComponents: Record<
  string,
  React.ComponentType<SurfaceProps>
> = {
  inbox: InboxSurface,
  calendar: CalendarSurface,
  discovery: DiscoverySurface,
  approval: ApprovalSurface,
  generic: GenericSurface,
  "connection-guide": ConnectionGuideSurface,
};
