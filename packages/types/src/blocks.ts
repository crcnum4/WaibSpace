/**
 * ComponentBlock — The AI's UI Language
 *
 * ComponentBlocks are recursive, typed UI descriptions that agents produce
 * and the WaibRenderer compiles into living interfaces. Every rendered element
 * is observable, and every user interaction — including unexpected ones —
 * feeds back into a learned behavioral model.
 */

import type { ProvenanceMetadata } from "./provenance";

// ---------------------------------------------------------------------------
// Core Block Types
// ---------------------------------------------------------------------------

export interface ComponentBlock {
  /** Unique instance ID — used for state lookup, event targeting, diffing, persistence */
  id: string;
  /** Registered component type: "Container", "Text", "List", "Image", etc. */
  type: string;
  /** Visual and behavioral props passed to the rendered component */
  props: Record<string, unknown>;
  /** Optional declared state shape (shared store, survives layout transitions) */
  state?: Record<string, ComponentStateDefinition>;
  /** Recursive nested blocks */
  children?: ComponentBlock[];
  /** Planned interaction handlers declared by the agent */
  events?: ComponentBlockEvents;
  /** Metadata: provenance, layout hints, tool bundle source */
  meta?: BlockMeta;
}

export interface ComponentStateDefinition {
  type: "string" | "number" | "boolean" | "object";
  default: unknown;
}

export interface BlockMeta {
  /** Links back to originating SurfaceSpec if transformed */
  surfaceId?: string;
  /** Original surface type (inbox, calendar, etc.) */
  surfaceType?: string;
  /** Data provenance from the originating agent */
  provenance?: ProvenanceMetadata;
  /** Tool bundle origin: "weather.waib", "builtin", "community" */
  source?: string;
  /** Layout directives */
  layoutHints?: BlockLayoutHints;
}

export interface BlockLayoutHints {
  width?: "full" | "half" | "third" | "auto";
  position?: "primary" | "secondary" | "sidebar" | "overlay";
  prominence?: "hero" | "standard" | "compact" | "minimal";
}

// ---------------------------------------------------------------------------
// Block Events — Planned Interactions
// ---------------------------------------------------------------------------

export interface ComponentBlockEvents {
  onClick?: ComponentEventAction;
  onHover?: ComponentEventAction;
  onScrollView?: ComponentEventAction;
  onDragStart?: ComponentEventAction;
  onDrop?: ComponentEventAction;
  onLongPress?: ComponentEventAction;
  onDoubleClick?: ComponentEventAction;
  onSwipe?: ComponentEventAction;
}

/**
 * ComponentEventAction — Declarative interaction handlers.
 *
 * Agents pre-plan what should happen when users interact with blocks.
 * Actions execute immediately (no agent round-trip), providing fast UX
 * while the observation layer captures the interaction in parallel.
 *
 * The `then` field enables chaining: setState → fetch → emit → navigate.
 */
export type ComponentEventAction =
  | SetStateAction
  | EmitAction
  | FetchAction
  | NavigateAction
  | SequenceAction;

export interface SetStateAction {
  action: "setState";
  /** Key in the shared block state store */
  key: string;
  /** Value to set */
  value: unknown;
  /** Optional next action in chain */
  then?: ComponentEventAction;
}

export interface EmitAction {
  action: "emit";
  /** Event type to emit on the EventBus */
  event: string;
  /** Event payload */
  payload?: unknown;
  /** Optional next action in chain */
  then?: ComponentEventAction;
}

export interface FetchAction {
  action: "fetch";
  /** API endpoint URL */
  url: string;
  /** HTTP method (defaults to GET) */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Request body */
  body?: unknown;
  /** Optional next action in chain */
  then?: ComponentEventAction;
}

export interface NavigateAction {
  action: "navigate";
  /** Route path to navigate to */
  path: string;
  /** Optional next action in chain */
  then?: ComponentEventAction;
}

export interface SequenceAction {
  action: "sequence";
  /** Ordered list of actions to execute */
  steps: ComponentEventAction[];
}

// ---------------------------------------------------------------------------
// Block Layout — Wire format for composed block trees
// ---------------------------------------------------------------------------

export interface BlockLayout {
  /** Root-level blocks to render */
  blocks: ComponentBlock[];
  /** When this layout was composed */
  timestamp: number;
  /** Trace ID linking to the originating pipeline execution */
  traceId: string;
  /** Agent errors that occurred during composition */
  errors?: BlockLayoutError[];
}

export interface BlockLayoutError {
  agentId: string;
  message: string;
  phase: string;
}

// ---------------------------------------------------------------------------
// Observation Types — Interaction capture
// ---------------------------------------------------------------------------

export type InteractionType =
  | "click"
  | "hover"
  | "scroll-view"
  | "drag-attempt"
  | "double-click"
  | "right-click"
  | "long-press"
  | "swipe";

export interface Observation {
  /** ID of the block that was interacted with */
  blockId: string;
  /** Type of the block (e.g., "ListItem", "Button") */
  blockType: string;
  /** Whether the block had a planned event handler for this interaction */
  wasPlanned: boolean;
  /** What kind of interaction occurred */
  interactionType: InteractionType;
  /** Position of interaction relative to block (optional) */
  position?: { x: number; y: number };
  /** Dwell time in ms (for hover interactions) */
  dwellMs?: number;
  /** How much of the block was visible (for scroll-view, 0-1) */
  viewportRatio?: number;
  /** When the interaction occurred */
  timestamp: number;
}

export interface ObservationBatch {
  /** Collected observations */
  observations: Observation[];
  /** Session identifier for correlating batches */
  sessionId: string;
  /** When this batch was flushed */
  batchTimestamp: number;
}

// ---------------------------------------------------------------------------
// Block Registry Types — Component Ecosystem
// ---------------------------------------------------------------------------

export interface BlockRegistration {
  /** Block type identifier (e.g., "Container", "WeatherCard") */
  type: string;
  /** "primitive" = ships with WaibSpace, "domain" = from tool bundle or community */
  category: "primitive" | "domain";
  /** Origin of the component: "builtin", "weather.waib", "community", etc. */
  source?: string;
  /** Human-readable description */
  description?: string;
}
