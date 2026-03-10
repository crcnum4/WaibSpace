import type { SurfaceSpec } from "@waibspace/types";
import type { ComposedLayout, AgentStatus } from "./layout";

// Backend → Frontend messages
export type ServerMessage =
  | { type: "surface.update"; payload: ComposedLayout }
  | {
      type: "surface.partial";
      payload: { surfaceId: string; spec: SurfaceSpec };
    }
  | {
      type: "approval.request";
      payload: { approvalId: string; surface: SurfaceSpec };
    }
  | { type: "status"; payload: { phase: string; agents: AgentStatus[] } }
  | { type: "error"; payload: { message: string; code: string } }
  | {
      type: "task.complete";
      payload: {
        taskId: string;
        taskName: string;
        success: boolean;
        durationMs: number;
        error?: string;
      };
    }
  | {
      type: "briefing.alert";
      payload: {
        itemId: string;
        cardType: string;
        title: string;
        context: string;
        urgency: string;
        source: string;
        suggestedAction?: string;
        timestamp: number;
      };
    };

// Frontend → Backend messages
export type ClientMessage =
  | { type: "user.message"; payload: { text: string } }
  | {
      type: "user.interaction";
      payload: {
        interaction: string;
        target: string;
        surfaceId?: string;
        surfaceType?: string;
        context?: unknown;
        timestamp: number;
        blockId?: string;
        blockType?: string;
        wasPlanned?: boolean;
        batch?: Array<{
          blockId: string;
          blockType: string;
          wasPlanned: boolean;
          interactionType: string;
          position?: { x: number; y: number };
          dwellMs?: number;
          viewportRatio?: number;
          timestamp: number;
        }>;
      };
    }
  | { type: "user.intent.url"; payload: { path: string; raw: string } }
  | {
      type: "approval.response";
      payload: { approvalId: string; approved: boolean };
    };
