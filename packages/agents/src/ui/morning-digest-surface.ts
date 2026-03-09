import type { AgentOutput } from "@waibspace/types";
import {
  SurfaceFactory,
  type MorningDigestSurfaceData,
} from "@waibspace/surfaces";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { DataRetrievalOutput } from "../context/data-retrieval";
import { classifyEmailUrgency } from "./email-urgency";

/**
 * MorningDigestAgent — produces a proactive summary surface combining inbox
 * highlights and today's calendar events.
 *
 * This agent runs as a scheduled background task (default 7 AM) and uses
 * heuristics only — no LLM dependency.
 */
export class MorningDigestAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.morning-digest",
      name: "MorningDigestAgent",
      type: "surface-builder",
      category: "ui",
    });
  }

  async execute(
    input: AgentInput,
    _context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    this.log("Building morning digest", { date: dateStr });

    // Extract data from prior retrieval outputs
    const retrieval = this.findDataRetrieval(input);
    const emails = retrieval ? this.extractEmails(retrieval) : [];
    const calendarEvents = retrieval
      ? this.extractCalendarEvents(retrieval)
      : [];

    // Classify urgency on emails using heuristics
    const classifiedEmails = emails.map((email, i) => {
      const { urgency } = classifyEmailUrgency(email);
      return {
        id: String(email.id ?? email.messageId ?? `email-${i}`),
        from: String(email.from || email.sender || "Unknown"),
        subject: String(email.subject || "No Subject"),
        snippet: String(
          email.snippet ?? email.text ?? email.body ?? "",
        ).slice(0, 200),
        isUnread: Boolean(email.isUnread ?? email.unread ?? true),
        urgency,
      };
    });

    const unreadCount = classifiedEmails.filter((e) => e.isUnread).length;
    const urgentEmails = classifiedEmails.filter(
      (e) => e.urgency === "high" || e.urgency === "medium",
    );

    // Map calendar events
    const todayEvents = calendarEvents.map((event, i) => ({
      id: String(
        (event as Record<string, unknown>).id ??
          (event as Record<string, unknown>).eventId ??
          `event-${i}`,
      ),
      title: String(
        (event as Record<string, unknown>).title ??
          (event as Record<string, unknown>).summary ??
          "Untitled Event",
      ),
      start: String(
        (event as Record<string, unknown>).start ??
          (event as Record<string, unknown>).startTime ??
          "",
      ),
      end: String(
        (event as Record<string, unknown>).end ??
          (event as Record<string, unknown>).endTime ??
          "",
      ),
      location:
        ((event as Record<string, unknown>).location as string) ?? undefined,
    }));

    // Build suggested actions based on heuristics
    const suggestedActions = this.buildSuggestedActions(
      unreadCount,
      urgentEmails,
      todayEvents,
    );

    // Generate greeting
    const hour = today.getHours();
    const timeOfDay =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const greeting = `Good ${timeOfDay} — here's your digest for ${this.formatDate(today)}`;

    const digestData: MorningDigestSurfaceData = {
      date: dateStr,
      greeting,
      inbox: {
        unreadCount,
        urgentEmails: urgentEmails.slice(0, 5), // cap at 5 urgent items
      },
      calendar: {
        eventCount: todayEvents.length,
        events: todayEvents,
      },
      suggestedActions,
      generatedAt: new Date().toISOString(),
    };

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
    };

    const surfaceSpec = SurfaceFactory.morningDigest(digestData, provenance);

    const endMs = Date.now();

    const summary = [
      `${unreadCount} unread email${unreadCount !== 1 ? "s" : ""}`,
      urgentEmails.length > 0 ? `${urgentEmails.length} urgent` : null,
      `${todayEvents.length} event${todayEvents.length !== 1 ? "s" : ""} today`,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      ...this.createOutput({ surfaceSpec, summary }, 0.9, provenance),
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }

  // ── Private helpers ────────────────────────────────────────────

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

  private extractEmails(
    retrieval: DataRetrievalOutput,
  ): Record<string, unknown>[] {
    const emailResults = retrieval.results.filter(
      (r) =>
        r.status === "fulfilled" &&
        (r.connectorId.includes("gmail") ||
          r.connectorId.includes("mail") ||
          r.operation.includes("email") ||
          r.operation.includes("inbox") ||
          r.operation.includes("unseen") ||
          r.operation.includes("recent")),
    );

    const NON_EMAIL_OPERATIONS = [
      "get_message_count",
      "get-inbox-stats",
      "get_connection_status",
      "connect_all",
      "disconnect_all",
      "list_mailboxes",
      "open_mailbox",
    ];

    const allEmails: Record<string, unknown>[] = [];
    for (const result of emailResults) {
      if (NON_EMAIL_OPERATIONS.includes(result.operation)) continue;
      const data = this.parseMCPContent(result.data) ?? result.data;
      if (Array.isArray(data)) {
        allEmails.push(...(data as Record<string, unknown>[]));
      } else if (data !== null && data !== undefined) {
        allEmails.push(data as Record<string, unknown>);
      }
    }
    return allEmails;
  }

  private extractCalendarEvents(retrieval: DataRetrievalOutput): unknown[] {
    const calendarResults = retrieval.results.filter(
      (r) =>
        r.status === "fulfilled" &&
        (r.connectorId.includes("calendar") ||
          r.operation.includes("calendar") ||
          r.operation.includes("events")),
    );

    const allEvents: unknown[] = [];
    for (const result of calendarResults) {
      const data = this.parseMCPContent(result.data) ?? result.data;
      if (Array.isArray(data)) {
        allEvents.push(...data);
      } else if (data !== null && data !== undefined) {
        allEvents.push(data);
      }
    }
    return allEvents;
  }

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

  private buildSuggestedActions(
    unreadCount: number,
    urgentEmails: Array<{
      id: string;
      from: string;
      subject: string;
      urgency: "high" | "medium";
    }>,
    todayEvents: Array<{ id: string; title: string; start: string }>,
  ): MorningDigestSurfaceData["suggestedActions"] {
    const actions: MorningDigestSurfaceData["suggestedActions"] = [];

    // Suggest reviewing urgent emails
    if (urgentEmails.length > 0) {
      const highOnly = urgentEmails.filter((e) => e.urgency === "high");
      const count = highOnly.length || urgentEmails.length;
      actions.push({
        id: "review-urgent",
        label: `Review ${count} urgent email${count !== 1 ? "s" : ""}`,
        reason: `You have ${count} email${count !== 1 ? "s" : ""} that may need immediate attention`,
        actionType: "navigate.inbox",
        payload: { filter: "urgent" },
      });
    }

    // Suggest inbox zero if many unread
    if (unreadCount > 10) {
      actions.push({
        id: "inbox-triage",
        label: "Triage your inbox",
        reason: `${unreadCount} unread emails — consider archiving or bulk-marking`,
        actionType: "navigate.inbox",
      });
    }

    // Suggest preparing for the next upcoming meeting
    const now = new Date();
    const upcomingEvents = todayEvents.filter((e) => {
      try {
        return new Date(e.start) > now;
      } catch {
        return false;
      }
    });
    if (upcomingEvents.length > 0) {
      const next = upcomingEvents[0];
      actions.push({
        id: "prepare-meeting",
        label: `Prepare for "${next.title}"`,
        reason: `Your next event starts at ${this.formatTime(next.start)}`,
        actionType: "navigate.calendar",
        payload: { eventId: next.id },
      });
    }

    return actions;
  }

  private formatDate(d: Date): string {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  private formatTime(isoStr: string): string {
    try {
      return new Date(isoStr).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  }
}
