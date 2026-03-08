import type { AgentOutput } from "@waibspace/types";
import {
  SurfaceFactory,
  type InboxSurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";

interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  urgency: "high" | "medium" | "low";
  suggestedReply?: string;
}

interface InboxAnalysis {
  emails: EmailSummary[];
  overallSummary: string;
}

const SYSTEM_PROMPT = `You are an email analysis agent for WaibSpace, an AI-powered personal assistant.

Given a set of email data, perform the following:
1. Summarize each email concisely in the snippet field
2. Classify urgency as "high", "medium", or "low" based on sender, subject, and content
3. For urgent emails (high urgency), generate a brief suggested reply
4. If calendar context is provided, cross-reference emails that mention meetings or events

Return a JSON object with:
- emails: array of processed email objects with id, from, subject, snippet (summarized), date, isUnread, urgency, and optional suggestedReply
- overallSummary: a brief summary of the inbox state`;

const INBOX_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    emails: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          from: { type: "string" },
          subject: { type: "string" },
          snippet: { type: "string" },
          date: { type: "string" },
          isUnread: { type: "boolean" },
          urgency: { type: "string", enum: ["high", "medium", "low"] },
          suggestedReply: { type: "string" },
        },
        required: ["id", "from", "subject", "snippet", "date", "isUnread", "urgency"],
      },
    },
    overallSummary: { type: "string" },
  },
  required: ["emails", "overallSummary"],
};

export class InboxSurfaceAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.inbox-surface",
      name: "InboxSurfaceAgent",
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
      throw new Error(
        "InboxSurfaceAgent requires DataRetrievalOutput from prior outputs",
      );
    }

    const gmailData = this.extractGmailData(retrievalOutput);
    const calendarData = this.extractCalendarData(input);

    this.log("Building inbox surface", {
      emailCount: Array.isArray(gmailData) ? gmailData.length : 0,
      hasCalendarContext: calendarData !== undefined,
    });

    const userMessage = JSON.stringify({
      emails: gmailData,
      calendarContext: calendarData,
    });

    const analysis = await this.completeStructured<InboxAnalysis>(
      context,
      "summarization",
      [{ role: "user", content: userMessage }],
      INBOX_ANALYSIS_SCHEMA,
      SYSTEM_PROMPT,
    );

    const unreadCount = analysis.emails.filter((e) => e.isUnread).length;

    const surfaceData: InboxSurfaceData = {
      emails: analysis.emails,
      totalCount: analysis.emails.length,
      unreadCount,
    };

    const endMs = Date.now();

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
      transformations: ["email-summarization", "urgency-classification"],
    };

    const surfaceSpec = SurfaceFactory.inbox(surfaceData, provenance);

    return {
      ...this.createOutput(
        { surfaceSpec, summary: analysis.overallSummary },
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

  private extractGmailData(retrieval: DataRetrievalOutput): unknown {
    const gmailResult = retrieval.results.find(
      (r) =>
        r.status === "fulfilled" &&
        (r.connectorId === "gmail" || r.operation.includes("email")),
    );
    return gmailResult?.data ?? [];
  }

  private extractCalendarData(input: AgentInput): unknown | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "context" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("results" in output) {
          const retrieval = output as unknown as DataRetrievalOutput;
          const calendarResult = retrieval.results.find(
            (r) =>
              r.status === "fulfilled" &&
              (r.connectorId === "google-calendar" ||
                r.operation.includes("calendar")),
          );
          if (calendarResult) return calendarResult.data;
        }
      }
    }
    return undefined;
  }
}
