import { describe, it, expect } from "vitest";
import { classifyEmailUrgency, classifyEmailBatch } from "./email-urgency";

describe("classifyEmailUrgency", () => {
  it("classifies email with urgent keywords as high", () => {
    const result = classifyEmailUrgency({
      from: "boss@company.com",
      subject: "URGENT: Please respond ASAP",
      snippet: "We need this done immediately",
      date: new Date().toISOString(),
      isUnread: true,
    });
    expect(result.urgency).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it("classifies email with action required as high", () => {
    const result = classifyEmailUrgency({
      from: "hr@company.com",
      subject: "Action Required: Submit your timesheet",
      snippet: "Deadline is end of day today",
      date: new Date().toISOString(),
      isUnread: true,
    });
    expect(result.urgency).toBe("high");
  });

  it("classifies noreply promotional email as low", () => {
    const result = classifyEmailUrgency({
      from: "noreply@store.com",
      subject: "50% off sale - limited time!",
      snippet: "Unsubscribe from this newsletter",
      date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      isUnread: false,
    });
    expect(result.urgency).toBe("low");
  });

  it("classifies newsletter digest as low", () => {
    const result = classifyEmailUrgency({
      from: "digest@news.com",
      subject: "Your weekly update",
      snippet: "Here is your weekly digest",
      date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      isUnread: false,
    });
    expect(result.urgency).toBe("low");
  });

  it("classifies a routine follow-up email as medium", () => {
    const result = classifyEmailUrgency({
      from: "colleague@company.com",
      subject: "Follow up on the proposal",
      snippet: "Just wanted to check in on progress",
      date: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      isUnread: true,
    });
    expect(result.urgency).toBe("medium");
  });

  it("boosts score for deep reply chains", () => {
    const shallow = classifyEmailUrgency({
      from: "peer@company.com",
      subject: "Project update",
      snippet: "Here is the latest",
      date: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    });
    const deep = classifyEmailUrgency({
      from: "peer@company.com",
      subject: "Re: Re: Re: Project update",
      snippet: "Here is the latest",
      date: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    });
    expect(deep.score).toBeGreaterThan(shallow.score);
  });

  it("boosts recent emails", () => {
    const old = classifyEmailUrgency({
      from: "someone@company.com",
      subject: "Hello",
      snippet: "Just checking in",
      date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    });
    const recent = classifyEmailUrgency({
      from: "someone@company.com",
      subject: "Hello",
      snippet: "Just checking in",
      date: new Date().toISOString(),
    });
    expect(recent.score).toBeGreaterThan(old.score);
  });

  it("penalizes emails with Gmail promotional labels", () => {
    const result = classifyEmailUrgency({
      from: "deals@shop.com",
      subject: "New arrivals",
      snippet: "Check out our latest products",
      labels: ["CATEGORY_PROMOTIONS"],
    });
    expect(result.urgency).toBe("low");
  });

  it("boosts emails with IMPORTANT label", () => {
    const without = classifyEmailUrgency({
      from: "someone@company.com",
      subject: "FYI",
      snippet: "See attached",
    });
    const withLabel = classifyEmailUrgency({
      from: "someone@company.com",
      subject: "FYI",
      snippet: "See attached",
      labels: ["IMPORTANT"],
    });
    expect(withLabel.score).toBeGreaterThan(without.score);
  });

  it("handles missing fields gracefully", () => {
    const result = classifyEmailUrgency({});
    expect(["high", "medium", "low"]).toContain(result.urgency);
    expect(typeof result.score).toBe("number");
  });
});

describe("classifyEmailBatch", () => {
  it("returns results for all emails in order", () => {
    const emails = [
      { from: "boss@co.com", subject: "URGENT: now" },
      { from: "noreply@spam.com", subject: "Sale ends today" },
    ];
    const results = classifyEmailBatch(emails);
    expect(results).toHaveLength(2);
    expect(results[0].urgency).toBeDefined();
    expect(results[1].urgency).toBeDefined();
  });
});
