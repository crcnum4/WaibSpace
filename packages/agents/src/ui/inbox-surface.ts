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
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    const { data: gmailData, totalUnread: gmailTotalUnread } = this.extractGmailData(retrievalOutput);
    const calendarData = this.extractCalendarData(input);

    // If no email data found, skip LLM call
    if (!gmailData || (Array.isArray(gmailData) && gmailData.length === 0)) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    // Truncate email data to avoid hitting token limits
    const truncatedData = this.truncateEmailData(gmailData);

    this.log("Building inbox surface", {
      emailDataSize: JSON.stringify(truncatedData).length,
      hasCalendarContext: calendarData !== undefined,
    });

    const userMessage = JSON.stringify({
      emails: truncatedData,
      calendarContext: calendarData,
    });

    const analysis = await this.completeStructured<InboxAnalysis>(
      context,
      "summarization",
      [{ role: "user", content: userMessage }],
      INBOX_ANALYSIS_SCHEMA,
      SYSTEM_PROMPT,
    );

    const batchUnreadCount = analysis.emails.filter((e) => e.isUnread).length;
    const unreadCount = gmailTotalUnread ?? batchUnreadCount;

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

  private extractGmailData(retrieval: DataRetrievalOutput): { data: unknown; totalUnread: number | undefined } {
    // Find email-related results from any connector (gmail, catalog-gmail, MCP mail, etc.)
    const emailResults = retrieval.results.filter(
      (r) =>
        r.status === "fulfilled" &&
        (r.connectorId.includes("gmail") ||
          r.connectorId.includes("mail") ||
          r.operation.includes("email") ||
          r.operation.includes("message") ||
          r.operation.includes("inbox")),
    );

    if (emailResults.length === 0) return { data: [], totalUnread: undefined };

    // Extract totalUnread from connector metadata if available
    let totalUnread: number | undefined;
    for (const result of emailResults) {
      const meta = (result as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      if (meta && typeof meta.totalUnread === "number") {
        totalUnread = meta.totalUnread;
        break;
      }
    }

    // Also check for get-inbox-stats results
    const statsResult = retrieval.results.find(
      (r) =>
        r.status === "fulfilled" &&
        r.operation === "get-inbox-stats",
    );
    if (statsResult && totalUnread === undefined) {
      const statsData = statsResult.data as Record<string, unknown> | undefined;
      if (statsData && typeof statsData.messagesUnread === "number") {
        totalUnread = statsData.messagesUnread;
      }
    }

    // MCP tools return [{type: "text", text: "..."}] — extract and parse the text content
    const allData: unknown[] = [];
    for (const result of emailResults) {
      const parsed = this.parseMCPContent(result.data);
      if (parsed !== undefined) {
        allData.push(parsed);
      } else {
        allData.push(result.data);
      }
    }
    return { data: allData, totalUnread };
  }

  /**
   * Parse MCP tool response format: [{type: "text", text: "...json..."}]
   */
  private parseMCPContent(data: unknown): unknown | undefined {
    if (!Array.isArray(data)) return undefined;
    const textBlock = data.find(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).type === "text",
    );
    if (!textBlock) return undefined;
    const text = (textBlock as Record<string, unknown>).text;
    if (typeof text !== "string") return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Truncate email data to keep the LLM prompt under token limits.
   * Keeps at most 20 emails, truncates body text to 500 chars each.
   */
  private truncateEmailData(data: unknown): unknown {
    const MAX_EMAILS = 20;
    const MAX_BODY_LENGTH = 500;
    const MAX_TOTAL_LENGTH = 50_000; // ~12k tokens

    if (Array.isArray(data)) {
      const truncated = data.slice(0, MAX_EMAILS).map((item: unknown) => {
        if (typeof item === "object" && item !== null) {
          const email = { ...(item as Record<string, unknown>) };
          // Truncate common body fields
          for (const key of ["text", "body", "snippet", "content", "html"]) {
            if (typeof email[key] === "string" && (email[key] as string).length > MAX_BODY_LENGTH) {
              email[key] = (email[key] as string).slice(0, MAX_BODY_LENGTH) + "...";
            }
          }
          return email;
        }
        return item;
      });
      return truncated;
    }

    // If it's a single large string, truncate it
    const str = JSON.stringify(data);
    if (str.length > MAX_TOTAL_LENGTH) {
      return JSON.parse(str.slice(0, MAX_TOTAL_LENGTH));
    }
    return data;
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
