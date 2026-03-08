import type { SurfaceSpec } from "@waibspace/types";

export interface LayoutDirective {
  surfaceId: string;
  position: number;
  width: string;
  prominence: string;
}

export interface AgentStatus {
  agentId: string;
  state: "pending" | "running" | "complete" | "error";
}

export interface ComposedLayout {
  surfaces: SurfaceSpec[];
  layout: LayoutDirective[];
  timestamp: number;
  traceId: string;
}
