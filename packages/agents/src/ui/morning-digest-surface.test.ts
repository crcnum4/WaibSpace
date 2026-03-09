import { describe, it, expect } from "vitest";
import { MorningDigestAgent } from "./morning-digest-surface";
import type { AgentInput, AgentContext } from "../types";
import type { WaibEvent, AgentOutput } from "@waibspace/types";

function makeEvent(payload: Record<string, unknown> = {}): WaibEvent {
  return {
    id: "test-event",
    type: "background.task.triggered",
    payload,
    source: "test",
    timestamp: Date.now(),
  } as WaibEvent;
}

function makeRetrievalOutput(
  emails: Record<string, unknown>[],
  calendarEvents: unknown[] = [],
): AgentOutput {
  const results = [];

  if (emails.length > 0) {
    results.push({
      connectorId: "gmail",
      operation: "get-recent-emails",
      status: "fulfilled" as const,
      data: emails,
    });
  }

  if (calendarEvents.length > 0) {
    results.push({
      connectorId: "google-calendar",
      operation: "get-today-events",
      status: "fulfilled" as const,
      data: calendarEvents,
    });
  }

  return {
    agentId: "context.data-retrieval",
    agentType: "data-retrieval",
    category: "context",
    output: {
      results,
      totalAttempted: results.length,
      totalFulfilled: results.length,
    },
    confidence: 1,
    provenance: {
      sourceType: "agent",
      sourceId: "context.data-retrieval",
      trustLevel: "trusted",
      timestamp: Date.now(),
      freshness: "realtime",
      dataState: "raw",
    },
    timing: { startMs: 0, endMs: 0, durationMs: 0 },
  };
}

function makeInput(
  emails: Record<string, unknown>[],
  calendarEvents: unknown[] = [],
): AgentInput {
  return {
    event: makeEvent({ taskId: "morning-digest" }),
    priorOutputs: [makeRetrievalOutput(emails, calendarEvents)],
  };
}

const context: AgentContext = { traceId: "test-trace" };

describe("MorningDigestAgent", () => {
  const agent = new MorningDigestAgent();

  it("produces a morning-digest surface with email and calendar data", async () => {
    const input = makeInput(
      [
        {
          id: "e1",
          from: "boss@co.com",
          subject: "URGENT: Need this ASAP",
          snippet: "Please respond immediately",
          date: new Date().toISOString(),
          isUnread: true,
        },
        {
          id: "e2",
          from: "noreply@store.com",
          subject: "50% off sale",
          snippet: "Unsubscribe from newsletter",
          date: new Date().toISOString(),
          isUnread: true,
        },
      ],
      [
        {
          id: "cal1",
          title: "Team standup",
          start: new Date(Date.now() + 3600000).toISOString(),
          end: new Date(Date.now() + 5400000).toISOString(),
          location: "Zoom",
        },
      ],
    );

    const result = await agent.execute(input, context);
    const { surfaceSpec } = result.output as Record<string, unknown>;
    const spec = surfaceSpec as Record<string, unknown>;

    expect(spec.surfaceType).toBe("morning-digest");
    expect(spec.priority).toBe(95);

    const data = spec.data as Record<string, unknown>;
    expect(data.date).toBeDefined();
    expect(data.greeting).toContain("digest for");

    const inbox = data.inbox as Record<string, unknown>;
    expect(inbox.unreadCount).toBe(2);

    const urgentEmails = inbox.urgentEmails as unknown[];
    // The urgent email should be included
    expect(urgentEmails.length).toBeGreaterThanOrEqual(1);

    const calendar = data.calendar as Record<string, unknown>;
    expect(calendar.eventCount).toBe(1);

    const events = calendar.events as unknown[];
    expect(events).toHaveLength(1);

    const actions = data.suggestedActions as unknown[];
    // Should suggest reviewing urgent emails and preparing for meeting
    expect(actions.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty data gracefully", async () => {
    const input: AgentInput = {
      event: makeEvent({ taskId: "morning-digest" }),
      priorOutputs: [],
    };

    const result = await agent.execute(input, context);
    const { surfaceSpec } = result.output as Record<string, unknown>;
    const spec = surfaceSpec as Record<string, unknown>;

    expect(spec.surfaceType).toBe("morning-digest");

    const data = spec.data as Record<string, unknown>;
    const inbox = data.inbox as Record<string, unknown>;
    expect(inbox.unreadCount).toBe(0);
    expect((inbox.urgentEmails as unknown[]).length).toBe(0);

    const calendar = data.calendar as Record<string, unknown>;
    expect(calendar.eventCount).toBe(0);
  });

  it("caps urgent emails at 5", async () => {
    const urgentEmails = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      from: "boss@co.com",
      subject: `URGENT: action required item ${i}`,
      snippet: "Respond ASAP immediately",
      date: new Date().toISOString(),
      isUnread: true,
    }));

    const input = makeInput(urgentEmails);
    const result = await agent.execute(input, context);
    const { surfaceSpec } = result.output as Record<string, unknown>;
    const data = (surfaceSpec as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    const inbox = data.inbox as Record<string, unknown>;
    expect((inbox.urgentEmails as unknown[]).length).toBeLessThanOrEqual(5);
  });

  it("suggests inbox triage when many unread emails", async () => {
    const emails = Array.from({ length: 15 }, (_, i) => ({
      id: `e${i}`,
      from: `person${i}@co.com`,
      subject: `Email ${i}`,
      snippet: "Some content",
      date: new Date().toISOString(),
      isUnread: true,
    }));

    const input = makeInput(emails);
    const result = await agent.execute(input, context);
    const { surfaceSpec } = result.output as Record<string, unknown>;
    const data = (surfaceSpec as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    const actions = data.suggestedActions as Array<{ id: string }>;
    const triageAction = actions.find((a) => a.id === "inbox-triage");
    expect(triageAction).toBeDefined();
  });
});
