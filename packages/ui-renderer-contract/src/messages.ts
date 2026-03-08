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
  | { type: "error"; payload: { message: string; code: string } };

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
      };
    }
  | { type: "user.intent.url"; payload: { path: string; raw: string } }
  | {
      type: "approval.response";
      payload: { approvalId: string; approved: boolean };
    };
