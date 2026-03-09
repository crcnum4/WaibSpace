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

Given a set of email data, process ALL of the provided emails. Do NOT filter or skip emails — include every email from the input in your output.

For each email:
1. Summarize it concisely in the snippet field
2. Classify urgency as "high" (from real people, time-sensitive), "medium" (useful but not urgent), or "low" (promotional, automated, newsletters)
3. For high-urgency emails, generate a brief suggested reply
4. If calendar context is provided, cross-reference emails that mention meetings or events

IMPORTANT: Your output MUST include ALL emails provided in the input, not just a subset. Sort them by urgency (high first, then medium, then low) and within each urgency level by date (newest first).

Return a JSON object with:
- emails: array of ALL processed email objects with id, from, subject, snippet (summarized), date, isUnread, urgency, and optional suggestedReply
- overallSummary: a brief summary of the inbox state (e.g., "5 emails: 1 urgent from a colleague, 2 medium, 2 promotional")`;

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

    // Detect WaibScan action — triggered when user clicks the WaibScan button
    const isWaibScan = this.isWaibScanAction(input);

    const retrievalOutput = this.findDataRetrieval(input);
    if (!retrievalOutput) {
      return this.createOutput(null, 0, {
        dataState: "raw",
        timestamp: startMs,
      });
    }

    const { data: gmailData, totalUnread: gmailTotalUnread, error: gmailError } = this.extractGmailData(retrievalOutput);

    // If data retrieval failed, return an error-state inbox surface
    if (gmailError) {
      this.log("Email retrieval failed, returning error surface", { error: gmailError });
      const surfaceData: InboxSurfaceData = {
        emails: [],
        totalCount: 0,
        unreadCount: 0,
        error: gmailError,
      };
      const provenance = {
        sourceType: "agent" as const,
        sourceId: this.id,
        trustLevel: "trusted" as const,
        timestamp: startMs,
        freshness: "realtime" as const,
        dataState: "raw" as const,
      };
      const surfaceSpec = SurfaceFactory.inbox(surfaceData, provenance);
      return {
        ...this.createOutput(
          { surfaceSpec, summary: gmailError },
          0.3,
          provenance,
        ),
        timing: {
          startMs,
          endMs: Date.now(),
          durationMs: Date.now() - startMs,
        },
      };
    }

    // If no email data found, return an empty inbox surface (not null)
    if (!gmailData || (Array.isArray(gmailData) && gmailData.length === 0)) {
      this.log("No email data found, returning empty inbox surface");

      const emptySurfaceData: InboxSurfaceData = {
        emails: [],
        totalCount: 0,
        unreadCount: 0,
      };

      const provenance = {
        sourceType: "agent" as const,
        sourceId: this.id,
        trustLevel: "trusted" as const,
        timestamp: startMs,
        freshness: "realtime" as const,
        dataState: "raw" as const,
      };

      const surfaceSpec = SurfaceFactory.inbox(emptySurfaceData, provenance);

      return {
        ...this.createOutput(
          { surfaceSpec, summary: "Your inbox is empty" },
          0.85,
          provenance,
        ),
        timing: {
          startMs,
          endMs: Date.now(),
          durationMs: Date.now() - startMs,
        },
      };
    }

    // Truncate to 20 emails max
    const truncatedData = this.truncateEmailData(gmailData);

    const rawEmails = (Array.isArray(truncatedData) ? truncatedData : [truncatedData]) as Record<string, unknown>[];

    this.log("Building inbox surface from raw email data", {
      rawEmailCount: Array.isArray(gmailData) ? gmailData.length : "non-array",
      truncatedEmailCount: rawEmails.length,
      totalUnreadFromMCP: gmailTotalUnread,
      isWaibScan,
    });

    // If WaibScan was triggered, run LLM analysis for urgency classification
    if (isWaibScan) {
      return this.executeWithLLMAnalysis(
        gmailData,
        rawEmails,
        gmailTotalUnread,
        input,
        context,
        startMs,
      );
    }

    // Default path: map raw email fields directly — no LLM involved
    const emails: InboxSurfaceData["emails"] = rawEmails.map((email, i) => ({
      id: String(email.id ?? email.messageId ?? `email-${i}`),
      from: String(email.from || email.sender || "Unknown"),
      subject: String(email.subject || "No Subject"),
      snippet: String(email.snippet ?? email.text ?? email.body ?? "").slice(0, 200),
      date: String(email.date ?? email.receivedAt ?? ""),
      isUnread: Boolean(email.isUnread ?? email.unread ?? true),
    }));

    const batchUnreadCount = emails.filter((e) => e.isUnread).length;
    const unreadCount = gmailTotalUnread ?? batchUnreadCount;

    const surfaceData: InboxSurfaceData = {
      emails,
      totalCount: emails.length,
      unreadCount,
    };

    const endMs = Date.now();

    const summary = `${emails.length} emails, ${unreadCount} unread`;

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "raw" as const,
    };

    const surfaceSpec = SurfaceFactory.inbox(surfaceData, provenance);

    // Add WaibScan action for on-demand LLM analysis
    surfaceSpec.actions.push({
      id: "waib-scan",
      label: "WaibScan Inbox",
      actionType: "agent.invoke",
      riskClass: "A",
      payload: { scope: "all" },
    });

    return {
      ...this.createOutput(
        { surfaceSpec, summary },
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

  /**
   * Check if the current event is a WaibScan action trigger.
   * This matches when the user clicks the WaibScan button, which emits
   * an interaction event with actionType "agent.invoke" and actionId "waib-scan".
   */
  private isWaibScanAction(input: AgentInput): boolean {
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (!payload) return false;

    // Match the emit action payload from the WaibScan button
    return (
      payload.actionId === "waib-scan" ||
      (payload.actionType === "agent.invoke" &&
        payload.interaction === "waib-scan")
    );
  }

  /**
   * Execute the LLM analysis path: classify urgency, generate suggested replies,
   * and produce an enriched inbox surface with a GmailScanResult summary.
   */
  private async executeWithLLMAnalysis(
    gmailData: unknown,
    rawEmails: Record<string, unknown>[],
    gmailTotalUnread: number | undefined,
    input: AgentInput,
    context: AgentContext,
    startMs: number,
  ): Promise<AgentOutput> {
    this.log("WaibScan triggered — running LLM analysis on inbox");

    const calendarData = this.extractCalendarData(input);
    const analysis = await this.analyzeWithLLM(gmailData, calendarData, context);

    // Build enriched email list with urgency and suggested replies from LLM
    const emails: InboxSurfaceData["emails"] = analysis.emails.map((email) => ({
      id: email.id,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      date: email.date,
      isUnread: email.isUnread,
      urgency: email.urgency,
      suggestedReply: email.suggestedReply,
    }));

    const batchUnreadCount = emails.filter((e) => e.isUnread).length;
    const unreadCount = gmailTotalUnread ?? batchUnreadCount;

    const surfaceData: InboxSurfaceData = {
      emails,
      totalCount: emails.length,
      unreadCount,
    };

    const endMs = Date.now();

    const summary = analysis.overallSummary;

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
    };

    const surfaceSpec = SurfaceFactory.inbox(surfaceData, provenance);

    // No WaibScan action — already scanned. The inbox transformer will
    // detect urgency data and render appropriately.

    return {
      ...this.createOutput(
        { surfaceSpec, summary },
        0.9,
        provenance,
      ),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  /**
   * Analyze emails with LLM for urgency classification and summarization.
   * Called by WaibScan action (see issue #166), not during initial render.
   */
  async analyzeWithLLM(
    emailData: unknown,
    calendarData: unknown | undefined,
    context: AgentContext,
  ): Promise<InboxAnalysis> {
    const truncatedData = this.truncateEmailData(emailData);

    const userMessage = JSON.stringify({
      emails: truncatedData,
      calendarContext: calendarData,
    });

    try {
      return await this.completeStructured<InboxAnalysis>(
        context,
        "summarization",
        [{ role: "user", content: userMessage }],
        INBOX_ANALYSIS_SCHEMA,
        SYSTEM_PROMPT,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.log("LLM analysis failed, falling back to raw email data", { error: errMsg });
      const rawEmails = (Array.isArray(truncatedData) ? truncatedData : [truncatedData]) as Record<string, unknown>[];
      return {
        emails: rawEmails.map((email, i) => ({
          id: String(email.id ?? email.messageId ?? `email-${i}`),
          from: String(email.from || email.sender || "Unknown"),
          subject: String(email.subject || "No Subject"),
          snippet: String(email.snippet ?? email.text ?? email.body ?? "").slice(0, 200),
          date: String(email.date ?? email.receivedAt ?? ""),
          isUnread: Boolean(email.isUnread ?? email.unread ?? true),
          urgency: "medium" as const,
        })),
        overallSummary: `${rawEmails.length} emails (LLM analysis unavailable)`,
      };
    }
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

  private extractGmailData(retrieval: DataRetrievalOutput): { data: unknown; totalUnread: number | undefined; error?: string } {
    const isEmailRelated = (r: { connectorId: string; operation: string }) =>
      r.connectorId.includes("gmail") ||
      r.connectorId.includes("mail") ||
      r.operation.includes("email") ||
      r.operation.includes("message") ||
      r.operation.includes("inbox") ||
      r.operation.includes("unseen") ||
      r.operation.includes("recent");

    // Find ALL email-related results (both fulfilled and rejected)
    const allEmailResults = retrieval.results.filter((r) => isEmailRelated(r));

    // If no email-related results at all, this isn't an email retrieval
    if (allEmailResults.length === 0) return { data: [], totalUnread: undefined };

    const rejectedEmailResults = allEmailResults.filter((r) => r.status === "rejected");
    const emailResults = allEmailResults.filter((r) => r.status === "fulfilled");

    // If ALL email results failed, signal an error instead of returning empty
    if (emailResults.length === 0 && rejectedEmailResults.length > 0) {
      const errors = rejectedEmailResults.map(
        (r) => `${r.connectorId}/${r.operation}: ${r.error ?? "unknown error"}`,
      );
      this.log("All email retrievals failed", { errors });
      return {
        data: [],
        totalUnread: undefined,
        error: `Gmail service unavailable (${rejectedEmailResults.length} request${rejectedEmailResults.length > 1 ? "s" : ""} failed)`,
      };
    }

    this.log("Found email results", {
      count: emailResults.length,
      operations: emailResults.map((r) => `${r.connectorId}:${r.operation}`),
    });

    // Extract totalUnread from connector metadata if available
    let totalUnread: number | undefined;
    for (const result of emailResults) {
      const meta = (result as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      if (meta && typeof meta.totalUnread === "number") {
        totalUnread = meta.totalUnread;
        break;
      }
    }

    // Check for get_message_count / get-inbox-stats results (MCP or native)
    const statsResult = retrieval.results.find(
      (r) =>
        r.status === "fulfilled" &&
        (r.operation === "get-inbox-stats" ||
          r.operation === "get_message_count"),
    );
    if (statsResult && totalUnread === undefined) {
      const parsed = this.parseMCPContent(statsResult.data);
      const statsData = (parsed ?? statsResult.data) as Record<string, unknown> | undefined;
      if (statsData) {
        // Try common count field names
        const count = statsData.messagesUnread ?? statsData.unseen ?? statsData.count ?? statsData.total;
        if (typeof count === "number") {
          totalUnread = count;
        }
      }
    }

    // MCP tools return [{type: "text", text: "..."}] — extract and parse the text content
    // Flatten all email arrays into a single list of email objects
    const allEmails: unknown[] = [];
    const NON_EMAIL_OPERATIONS = [
      "get_message_count", "get-inbox-stats", "get_connection_status",
      "connect_all", "disconnect_all", "list_mailboxes", "open_mailbox",
    ];
    for (const result of emailResults) {
      // Skip non-email-data results
      if (NON_EMAIL_OPERATIONS.includes(result.operation)) {
        continue;
      }

      const parsed = this.parseMCPContent(result.data);
      const data = parsed ?? result.data;

      this.log("Parsed email result", {
        operation: result.operation,
        dataType: Array.isArray(data) ? `array[${(data as unknown[]).length}]` : typeof data,
      });

      // Flatten: if the parsed data is an array, spread it into allEmails
      if (Array.isArray(data)) {
        allEmails.push(...data);
      } else if (data !== null && data !== undefined) {
        allEmails.push(data);
      }
    }

    this.log("Extracted emails", { totalEmails: allEmails.length, totalUnread });

    return { data: allEmails, totalUnread };
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
   * Truncate email data to keep within limits.
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
