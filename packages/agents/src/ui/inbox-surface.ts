import type { AgentOutput } from "@waibspace/types";
import {
  SurfaceFactory,
  type InboxSurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";
import { classifyEmailUrgency } from "./email-urgency";
import type { TriageOutput, TriagedItem } from "../triage/types";

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
    // @deprecated WaibScan is no longer needed — triage is always-on.
    // Kept for backward compatibility with existing button interactions.
    const isWaibScan = this.isWaibScanAction(input);

    // Check for triage output first — AI always triages now
    const triageData = this.findTriageOutput(input);
    if (triageData) {
      return this.executeWithTriageData(triageData, input, startMs);
    }

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

    // Truncate to 10 emails max
    const originalCount = Array.isArray(gmailData) ? gmailData.length : 1;
    const truncatedData = this.truncateEmailData(gmailData);

    const rawEmails = (Array.isArray(truncatedData) ? truncatedData : [truncatedData]) as Record<string, unknown>[];
    const isTruncated = originalCount > rawEmails.length;

    this.log("Building inbox surface from raw email data", {
      rawEmailCount: originalCount,
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
    // Apply lightweight heuristic urgency scoring (no LLM cost)
    const emails: InboxSurfaceData["emails"] = rawEmails.map((email, i) => {
      const normalized = this.normalizeEmailFields(email, i);
      const { urgency } = classifyEmailUrgency(email);
      return {
        ...normalized,
        urgency,
      };
    });

    const batchUnreadCount = emails.filter((e) => e.isUnread).length;
    const unreadCount = gmailTotalUnread ?? batchUnreadCount;

    const surfaceData: InboxSurfaceData = {
      emails,
      totalCount: emails.length,
      unreadCount,
      ...(isTruncated && { isTruncated: true, fullCount: originalCount }),
    };

    const endMs = Date.now();

    const summary = isTruncated
      ? `${emails.length} of ${originalCount} emails, ${unreadCount} unread`
      : `${emails.length} emails, ${unreadCount} unread`;

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "raw" as const,
    };

    const surfaceSpec = SurfaceFactory.inbox(surfaceData, provenance);

    // WaibScan button removed — triage is always-on now.
    // The triage phase runs automatically in the pipeline.

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
   * Find triage output from prior pipeline outputs.
   * Returns the first TriageOutput[] from the triage phase.
   */
  private findTriageOutput(input: AgentInput): TriageOutput[] | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "triage" && prior.output) {
        const output = prior.output as unknown;
        // DataTriageAgent outputs TriageOutput[] via createOutput
        if (Array.isArray(output) && output.length > 0) {
          return output as TriageOutput[];
        }
      }
    }
    return undefined;
  }

  /**
   * Build inbox surface from triage data — items are pre-classified with
   * urgency, category, and suggested actions. Sorted by urgency (high first).
   */
  private executeWithTriageData(
    triageOutputs: TriageOutput[],
    input: AgentInput,
    startMs: number,
  ): AgentOutput {
    // Flatten all triaged items from all connectors
    const allItems: TriagedItem[] = [];
    for (const triageOutput of triageOutputs) {
      allItems.push(...triageOutput.items);
    }

    if (allItems.length === 0) {
      this.log("Triage produced no items, returning empty inbox surface");
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
        dataState: "transformed" as const,
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

    // Sort by urgency: high → medium → low
    const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sortedItems = [...allItems].sort(
      (a, b) =>
        (urgencyOrder[a.triage.urgency] ?? 2) -
        (urgencyOrder[b.triage.urgency] ?? 2),
    );

    // Map triaged items to inbox email format
    const emails: InboxSurfaceData["emails"] = sortedItems.map((item, i) => {
      const raw = item.raw as Record<string, unknown>;
      const normalized = this.normalizeEmailFields(raw, i);
      return {
        ...normalized,
        urgency: item.triage.urgency,
        // Include category as a badge hint for the UI
        category: item.triage.category as string,
        suggestedReply:
          item.triage.suggestedAction === "reply"
            ? "Reply suggested"
            : undefined,
      };
    });

    const unreadCount = emails.filter((e) => e.isUnread).length;

    // Compute stats summary
    const stats = triageOutputs[0]?.stats;
    const highCount = stats?.byUrgency.high ?? 0;
    const mediumCount = stats?.byUrgency.medium ?? 0;
    const lowCount = stats?.byUrgency.low ?? 0;

    const summary = `${emails.length} emails triaged: ${highCount} urgent, ${mediumCount} medium, ${lowCount} low`;

    const surfaceData: InboxSurfaceData = {
      emails,
      totalCount: emails.length,
      unreadCount,
    };

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
    };

    const surfaceSpec = SurfaceFactory.inbox(surfaceData, provenance);

    const endMs = Date.now();

    this.log("Built inbox surface from triage data", {
      total: emails.length,
      highUrgency: highCount,
      mediumUrgency: mediumCount,
      lowUrgency: lowCount,
    });

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
        emails: rawEmails.map((email, i) => {
          const normalized = this.normalizeEmailFields(email, i);
          const { urgency } = classifyEmailUrgency(email);
          return {
            ...normalized,
            urgency,
          };
        }),
        overallSummary: `${rawEmails.length} emails (LLM analysis unavailable, heuristic urgency applied)`,
      };
    }
  }

  /**
   * Normalize email fields from raw MCP data.
   *
   * MCP mail servers (e.g. mcp-mail-server) sometimes return empty from/subject
   * fields while the actual headers are embedded in the raw MIME `text` field.
   * This method:
   * 1. Tries standard field names, then alternative names (From, sender, uid, etc.)
   * 2. If `from` is still empty, attempts to parse From: header from MIME text
   * 3. If `subject` is empty/"No Subject", attempts to parse Subject: header from MIME text
   * 4. Handles `from` being an object ({name, address})
   * 5. Normalizes unread status from IMAP flags
   */
  private normalizeEmailFields(
    email: Record<string, unknown>,
    index: number,
  ): Omit<EmailSummary, "urgency" | "suggestedReply"> {
    // --- ID ---
    const id = String(
      email.id ?? email.uid ?? email.messageId ?? email.message_id ?? `email-${index}`,
    );

    // --- FROM ---
    let from = "";
    // Try standard fields
    const rawFrom = email.from ?? email.From ?? email.sender ?? email.Sender;
    if (rawFrom) {
      if (typeof rawFrom === "string") {
        from = rawFrom;
      } else if (typeof rawFrom === "object" && rawFrom !== null) {
        // Handle {name, address} or {value: [{name, address}]}
        const obj = rawFrom as Record<string, unknown>;
        if (obj.address) {
          from = obj.name ? `${obj.name} <${obj.address}>` : String(obj.address);
        } else if (obj.name) {
          from = String(obj.name);
        } else if (Array.isArray(obj.value)) {
          const first = obj.value[0] as Record<string, unknown> | undefined;
          if (first?.address) {
            from = first.name ? `${first.name} <${first.address}>` : String(first.address);
          }
        }
      }
    }
    // If still empty, try to extract From: header from MIME text
    if (!from) {
      from = this.extractMimeHeader(email, "From") || "Unknown";
    }

    // --- SUBJECT ---
    let subject = String(email.subject ?? email.Subject ?? "");
    if (!subject || subject === "No Subject") {
      const parsed = this.extractMimeHeader(email, "Subject");
      if (parsed) subject = parsed;
    }
    if (!subject) subject = "No Subject";

    // --- DATE ---
    const date = String(
      email.date ?? email.Date ?? email.receivedAt ?? email.received_at ?? "",
    );

    // --- SNIPPET ---
    let snippet = String(
      email.snippet ?? email.text ?? email.body ?? email.textBody ?? "",
    );
    // Strip MIME headers from snippet if they leaked into it
    snippet = snippet.replace(/^(From:|To:|Subject:|Date:|MIME-Version:|Content-Type:)[^\n]*\n/gm, "").trim();
    snippet = snippet.slice(0, 200);

    // --- UNREAD ---
    let isUnread: boolean;
    if (typeof email.isUnread === "boolean") {
      isUnread = email.isUnread;
    } else if (typeof email.unread === "boolean") {
      isUnread = email.unread;
    } else if (Array.isArray(email.flags)) {
      // IMAP flags: if \\Seen is present, it's read
      isUnread = !(email.flags as string[]).some(
        (f) => f === "\\Seen" || f === "\\seen" || f.toLowerCase() === "\\seen",
      );
    } else {
      isUnread = true;
    }

    return { id, from, subject, snippet, date, isUnread };
  }

  /**
   * Extract a specific header value from raw MIME text embedded in email fields.
   * Handles formats like:
   *   From: "John Doe" <john@example.com>
   *   From: john@example.com
   *   From: "Google Workspace Team" [workspace-noreply@google.com]
   */
  private extractMimeHeader(
    email: Record<string, unknown>,
    headerName: string,
  ): string | undefined {
    // Look in text, body, textBody, content fields
    const textContent = String(email.text ?? email.body ?? email.textBody ?? email.content ?? "");
    if (!textContent) return undefined;

    // Try exact header line match
    const lineRegex = new RegExp(`^${headerName}:\\s*(.+)$`, "m");
    const lineMatch = textContent.match(lineRegex);
    if (lineMatch) {
      const raw = lineMatch[1].trim();
      if (headerName === "From") {
        return this.parseFromValue(raw);
      }
      return raw;
    }

    return undefined;
  }

  /**
   * Parse a From header value into a clean display string.
   * Handles:
   *   "John Doe" <john@example.com>  -> John Doe <john@example.com>
   *   john@example.com               -> john@example.com
   *   "Team Name" [addr@example.com] -> Team Name <addr@example.com>
   */
  private parseFromValue(raw: string): string {
    // Pattern: "Display Name" <email@addr> or Display Name <email@addr>
    const angleBracket = raw.match(/"?([^"<]+)"?\s*<([^>]+)>/);
    if (angleBracket) {
      const name = angleBracket[1].trim();
      const addr = angleBracket[2].trim();
      return name ? `${name} <${addr}>` : addr;
    }

    // Pattern: "Display Name" [email@addr] (seen in some MCP servers)
    const squareBracket = raw.match(/"?([^"[\]]+)"?\s*\[([^\]]+)\]/);
    if (squareBracket) {
      const name = squareBracket[1].trim();
      const addr = squareBracket[2].trim();
      return name ? `${name} <${addr}>` : addr;
    }

    // Plain email or text
    return raw.trim();
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
   * Keeps at most 10 emails, truncates body text to 500 chars each.
   */
  private truncateEmailData(data: unknown): unknown {
    const MAX_EMAILS = 10;
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
