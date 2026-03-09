import { describe, it, expect } from "vitest";
import {
  validateResponse,
  extractPayload,
  KNOWN_SCHEMAS,
  type ResponseSchema,
} from "./validation";

// ---------------------------------------------------------------------------
// extractPayload
// ---------------------------------------------------------------------------
describe("extractPayload", () => {
  it("parses JSON from an MCP text content block", () => {
    const content = [{ type: "text", text: '{"id":"1","subject":"Hello"}' }];
    expect(extractPayload(content)).toEqual({ id: "1", subject: "Hello" });
  });

  it("returns raw text when JSON parsing fails", () => {
    const content = [{ type: "text", text: "not json" }];
    expect(extractPayload(content)).toBe("not json");
  });

  it("returns non-array content as-is", () => {
    expect(extractPayload("hello")).toBe("hello");
    expect(extractPayload(42)).toBe(42);
  });

  it("returns content as-is when no text block found", () => {
    const content = [{ type: "image", data: "..." }];
    expect(extractPayload(content)).toEqual(content);
  });
});

// ---------------------------------------------------------------------------
// validateResponse — generic
// ---------------------------------------------------------------------------
describe("validateResponse", () => {
  const emailListSchema: ResponseSchema = {
    description: "test email list",
    isArray: true,
    fields: {
      id: { type: "string", required: true },
      from: { type: "string", required: true },
      subject: { type: "string", required: true },
      snippet: { type: "string", required: false },
    },
  };

  it("returns valid for a correct array response", () => {
    const data = [
      { id: "1", from: "a@b.com", subject: "Hi", snippet: "..." },
      { id: "2", from: "c@d.com", subject: "Re: Hi" },
    ];
    const result = validateResponse(data, emailListSchema);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when required field is missing", () => {
    const data = [{ id: "1", from: "a@b.com" }]; // missing subject
    const result = validateResponse(data, emailListSchema);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.stringContaining("subject"),
    );
  });

  it("warns when field has wrong type", () => {
    const data = [{ id: 123, from: "a@b.com", subject: "Hi" }];
    const result = validateResponse(data, emailListSchema);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.stringContaining("expected string"),
    );
  });

  it("warns when expected array but got object", () => {
    const result = validateResponse({ id: "1" }, emailListSchema);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("Expected array");
  });

  it("handles null response", () => {
    const result = validateResponse(null, emailListSchema);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("null");
  });

  it("handles undefined response", () => {
    const result = validateResponse(undefined, emailListSchema);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("undefined");
  });

  it("validates a single-object schema", () => {
    const schema: ResponseSchema = {
      description: "single email",
      isArray: false,
      fields: {
        id: { type: "string", required: true },
        body: { type: "string", required: false },
      },
    };
    const result = validateResponse({ id: "abc" }, schema);
    expect(result.valid).toBe(true);
  });

  it("limits array validation to first 5 items", () => {
    // Create 10 items where items 6-10 are invalid
    const data = Array.from({ length: 10 }, (_, i) => ({
      id: i < 5 ? String(i) : 999, // items 5-9 have wrong type
      from: "a@b.com",
      subject: "Test",
    }));
    const result = validateResponse(data, emailListSchema);
    // Should only have checked first 5 items (all valid)
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KNOWN_SCHEMAS sanity check
// ---------------------------------------------------------------------------
describe("KNOWN_SCHEMAS", () => {
  it("has schemas for core Gmail operations", () => {
    expect(KNOWN_SCHEMAS.listEmails).toBeDefined();
    expect(KNOWN_SCHEMAS.getEmail).toBeDefined();
    expect(KNOWN_SCHEMAS.searchEmails).toBeDefined();
    expect(KNOWN_SCHEMAS.sendEmail).toBeDefined();
  });

  it("has schemas for core Calendar operations", () => {
    expect(KNOWN_SCHEMAS.listEvents).toBeDefined();
    expect(KNOWN_SCHEMAS.getEvent).toBeDefined();
    expect(KNOWN_SCHEMAS.createEvent).toBeDefined();
    expect(KNOWN_SCHEMAS.freeSlots).toBeDefined();
  });

  it("Gmail listEmails schema validates realistic data", () => {
    const data = [
      {
        id: "msg-1",
        from: "sender@example.com",
        subject: "Meeting tomorrow",
        snippet: "Don't forget about...",
        date: "2026-03-09T10:00:00Z",
      },
    ];
    const result = validateResponse(data, KNOWN_SCHEMAS.listEmails);
    expect(result.valid).toBe(true);
  });

  it("Calendar listEvents schema validates realistic data", () => {
    const data = [
      {
        id: "evt-1",
        summary: "Team standup",
        start: "2026-03-09T09:00:00Z",
        end: "2026-03-09T09:15:00Z",
        status: "confirmed",
      },
    ];
    const result = validateResponse(data, KNOWN_SCHEMAS.listEvents);
    expect(result.valid).toBe(true);
  });
});
