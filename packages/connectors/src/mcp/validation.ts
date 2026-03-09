/**
 * MCP tool response validation.
 *
 * Validates that MCP tool responses conform to expected shapes so that
 * downstream agents (e.g. InboxSurfaceAgent) don't silently fail on
 * malformed data. Validation is best-effort: warnings are logged but
 * data is still passed through to avoid hard failures.
 */

// ---------------------------------------------------------------------------
// Core validation helpers
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

type FieldSpec =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "any";

interface SchemaField {
  type: FieldSpec;
  required: boolean;
}

export interface ResponseSchema {
  /** Human-readable description for log messages. */
  description: string;
  /**
   * If true, the response is expected to be an array of objects that each
   * match `fields`. If false, the response itself is a single object.
   */
  isArray: boolean;
  /** Expected fields on each object (or the single object). */
  fields: Record<string, SchemaField>;
}

function checkType(value: unknown, expected: FieldSpec): boolean {
  if (expected === "any") return true;
  if (expected === "array") return Array.isArray(value);
  if (expected === "object")
    return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === expected;
}

/**
 * Validate a single object against a set of field specs.
 */
function validateObject(
  obj: unknown,
  fields: Record<string, SchemaField>,
  path: string,
): string[] {
  const warnings: string[] = [];

  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    warnings.push(`${path}: expected object, got ${typeof obj}`);
    return warnings;
  }

  const record = obj as Record<string, unknown>;

  for (const [key, spec] of Object.entries(fields)) {
    const value = record[key];

    if (value === undefined || value === null) {
      if (spec.required) {
        warnings.push(`${path}.${key}: required field is missing`);
      }
      continue;
    }

    if (!checkType(value, spec.type)) {
      warnings.push(
        `${path}.${key}: expected ${spec.type}, got ${Array.isArray(value) ? "array" : typeof value}`,
      );
    }
  }

  return warnings;
}

/**
 * Validate an MCP tool response against a schema.
 *
 * Returns a ValidationResult. The `valid` flag is false when any warning
 * is present, but the caller should still forward the data — validation
 * is advisory, not blocking.
 */
export function validateResponse(
  data: unknown,
  schema: ResponseSchema,
): ValidationResult {
  const warnings: string[] = [];

  if (data === undefined || data === null) {
    warnings.push(`Response is ${data === null ? "null" : "undefined"}`);
    return { valid: false, warnings };
  }

  if (schema.isArray) {
    if (!Array.isArray(data)) {
      warnings.push(
        `Expected array for "${schema.description}", got ${typeof data}`,
      );
      return { valid: false, warnings };
    }

    // Validate up to the first 5 items to keep logs reasonable
    const limit = Math.min(data.length, 5);
    for (let i = 0; i < limit; i++) {
      warnings.push(
        ...validateObject(data[i], schema.fields, `[${i}]`),
      );
    }
  } else {
    warnings.push(...validateObject(data, schema.fields, "root"));
  }

  return { valid: warnings.length === 0, warnings };
}

// ---------------------------------------------------------------------------
// Known response schemas for common MCP tools (Gmail, Google Calendar)
// ---------------------------------------------------------------------------

const field = (type: FieldSpec, required = true): SchemaField => ({
  type,
  required,
});

export const KNOWN_SCHEMAS: Record<string, ResponseSchema> = {
  // Gmail -------------------------------------------------------------------
  listEmails: {
    description: "Gmail listEmails",
    isArray: true,
    fields: {
      id: field("string"),
      from: field("string"),
      subject: field("string"),
      snippet: field("string", false),
      date: field("string"),
    },
  },
  getEmail: {
    description: "Gmail getEmail",
    isArray: false,
    fields: {
      id: field("string"),
      from: field("string"),
      to: field("string"),
      subject: field("string"),
      body: field("string", false),
      date: field("string"),
    },
  },
  searchEmails: {
    description: "Gmail searchEmails",
    isArray: true,
    fields: {
      id: field("string"),
      from: field("string"),
      subject: field("string"),
      snippet: field("string", false),
      date: field("string"),
    },
  },
  sendEmail: {
    description: "Gmail sendEmail",
    isArray: false,
    fields: {
      success: field("boolean", false),
      messageId: field("string", false),
    },
  },

  // Google Calendar ---------------------------------------------------------
  listEvents: {
    description: "Calendar listEvents",
    isArray: true,
    fields: {
      id: field("string"),
      summary: field("string"),
      start: field("string"),
      end: field("string"),
      status: field("string", false),
    },
  },
  getEvent: {
    description: "Calendar getEvent",
    isArray: false,
    fields: {
      id: field("string"),
      summary: field("string"),
      start: field("string"),
      end: field("string"),
      location: field("string", false),
      description: field("string", false),
      status: field("string", false),
    },
  },
  createEvent: {
    description: "Calendar createEvent",
    isArray: false,
    fields: {
      id: field("string", false),
      summary: field("string", false),
      start: field("string", false),
      end: field("string", false),
    },
  },
  freeSlots: {
    description: "Calendar freeSlots",
    isArray: true,
    fields: {
      start: field("string"),
      end: field("string"),
    },
  },
};

// ---------------------------------------------------------------------------
// Convenience: extract a JSON value from MCP content blocks
// ---------------------------------------------------------------------------

/**
 * MCP tool results come back as an array of content blocks. This helper
 * extracts the first text block and attempts to JSON.parse it so that
 * schema validation can run against the parsed payload.
 *
 * Returns the parsed value or the raw content unchanged if parsing fails.
 */
export function extractPayload(content: unknown): unknown {
  if (!Array.isArray(content)) return content;

  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      (block as Record<string, unknown>).type === "text"
    ) {
      const text = (block as Record<string, unknown>).text;
      if (typeof text === "string") {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
    }
  }

  // Fallback: return content as-is
  return content;
}
