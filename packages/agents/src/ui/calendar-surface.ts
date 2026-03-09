import type { AgentOutput } from "@waibspace/types";
import {
  SurfaceFactory,
  type CalendarSurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";

interface CalendarAnalysis {
  events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    attendees?: string[];
    conflictWith?: string;
  }>;
  freeSlots: Array<{ start: string; end: string }>;
  dateRange: { start: string; end: string };
  busyPattern: string;
  emailRelatedEvents: string[];
}

const SYSTEM_PROMPT = `You are a calendar analysis agent for WaibSpace, an AI-powered personal assistant.

Given calendar event data (and optionally email context), perform the following:
1. List all events with their details (id, title, start, end, location, attendees)
2. Identify scheduling conflicts - if two events overlap, set conflictWith to the other event's id
3. Identify free slots between events within the date range
4. Summarize the user's busy/free patterns (e.g., "Mostly busy mornings, free afternoons")
5. If email context is provided, highlight which events are referenced in emails

Return a JSON object with:
- events: array of calendar events with conflict detection
- freeSlots: array of {start, end} for available time blocks
- dateRange: {start, end} of the analyzed period
- busyPattern: brief summary of busy/free patterns
- emailRelatedEvents: array of event IDs that are referenced in email context`;

const CALENDAR_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          location: { type: "string" },
          attendees: {
            type: "array",
            items: { type: "string" },
          },
          conflictWith: { type: "string" },
        },
        required: ["id", "title", "start", "end"],
      },
    },
    freeSlots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
        },
        required: ["start", "end"],
      },
    },
    dateRange: {
      type: "object",
      properties: {
        start: { type: "string" },
        end: { type: "string" },
      },
      required: ["start", "end"],
    },
    busyPattern: { type: "string" },
    emailRelatedEvents: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["events", "freeSlots", "dateRange", "busyPattern", "emailRelatedEvents"],
};

export class CalendarSurfaceAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.calendar-surface",
      name: "CalendarSurfaceAgent",
      type: "surface-builder",
      category: "ui",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const retrievalOutput = this.findDataRetrieval(input);
    if (!retrievalOutput) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    const calendarData = this.extractCalendarData(retrievalOutput);

    // If no calendar data found, skip — don't hallucinate a calendar from nothing
    if (!calendarData || (Array.isArray(calendarData) && calendarData.length === 0)) {
      this.log("No calendar data found, skipping calendar surface");
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    const emailContext = this.extractEmailContext(input);

    this.log("Building calendar surface", {
      eventCount: Array.isArray(calendarData) ? calendarData.length : 0,
      hasEmailContext: emailContext !== undefined,
    });

    const userMessage = JSON.stringify({
      calendarEvents: calendarData,
      emailContext,
    });

    const analysis = await this.completeStructured<CalendarAnalysis>(
      context,
      "summarization",
      [{ role: "user", content: userMessage }],
      CALENDAR_ANALYSIS_SCHEMA,
      SYSTEM_PROMPT,
    );

    const surfaceData: CalendarSurfaceData = {
      events: analysis.events,
      freeSlots: analysis.freeSlots,
      dateRange: analysis.dateRange,
    };

    const endMs = Date.now();

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
      transformations: ["conflict-detection", "free-slot-analysis"],
    };

    const surfaceSpec = SurfaceFactory.calendar(surfaceData, provenance);

    return {
      ...this.createOutput(
        { surfaceSpec, busyPattern: analysis.busyPattern },
        0.85,
        provenance,
      ),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findDataRetrieval(
    input: AgentInput,
  ): DataRetrievalOutput | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "context" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("results" in output && "totalAttempted" in output) {
          return output as unknown as DataRetrievalOutput;
        }
      }
    }
    return undefined;
  }

  private extractCalendarData(retrieval: DataRetrievalOutput): unknown {
    const calendarResult = retrieval.results.find(
      (r) =>
        r.status === "fulfilled" &&
        (r.connectorId.includes("calendar") ||
          r.operation.includes("calendar") ||
          r.operation.includes("event")),
    );
    return calendarResult?.data ?? [];
  }

  private extractEmailContext(input: AgentInput): unknown | undefined {
    for (const prior of input.priorOutputs) {
      if (
        prior.category === "ui" &&
        prior.agentId === "ui.inbox-surface" &&
        prior.output
      ) {
        return prior.output;
      }
    }
    return undefined;
  }
}
