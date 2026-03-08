import type { ProvenanceMetadata } from "./provenance";

export interface SurfaceAction {
  id: string;
  label: string;
  actionType: string;
  riskClass: "A" | "B" | "C";
  payload?: unknown;
}

export interface SurfaceAffordance {
  interaction: string;
  meaning: string;
  surfaceTarget?: string;
}

export interface LayoutHints {
  width?: "full" | "half" | "third" | "auto";
  position?: "primary" | "secondary" | "sidebar" | "overlay";
  prominence?: "hero" | "standard" | "compact" | "minimal";
}

export interface SurfaceSpec {
  surfaceType: string;
  surfaceId: string;
  title: string;
  summary?: string;
  priority: number;
  data: unknown;
  actions: SurfaceAction[];
  affordances: SurfaceAffordance[];
  layoutHints: LayoutHints;
  provenance: ProvenanceMetadata;
  confidence: number;
}
