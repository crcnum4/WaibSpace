import type { MidTermMemory } from "./midterm-memory";
import type { LongTermMemory } from "./longterm-memory";
import type { ShortTermStore } from "./short-term-memory";

/**
 * Build a memory context string for LLM prompt injection.
 * Combines relevant mid-term and long-term memories.
 */
export function buildMemoryContext(
  shortTerm: ShortTermStore | undefined,
  midTerm: MidTermMemory,
  longTerm: LongTermMemory,
  domains: string[],
  searchKeywords?: string[],
): string {
  const sections: string[] = [];

  // Short-term task memory
  if (shortTerm) {
    const stContext = shortTerm.toContext();
    if (stContext) sections.push(stContext);
  }

  // Mid-term domain-scoped memory
  const mtContext = midTerm.toContext(domains);
  if (mtContext) sections.push(mtContext);

  // Long-term keyword recall
  if (searchKeywords && searchKeywords.length > 0) {
    const query = searchKeywords.join(" ");
    const ltContext = longTerm.toContext(query, 5);
    if (ltContext) sections.push(ltContext);
  }

  if (sections.length === 0) return "";
  return "## Relevant Memory\n\n" + sections.join("\n\n");
}

/**
 * Extract potential search keywords from event payload.
 * Looks for names, topics, subjects, etc.
 */
export function extractKeywords(payload?: Record<string, unknown>): string[] {
  if (!payload) return [];
  const keywords: string[] = [];

  // Common fields that might contain searchable terms
  const fields = ["from", "sender", "subject", "topic", "name", "query", "search"];
  for (const field of fields) {
    const val = payload[field];
    if (typeof val === "string" && val.length > 0 && val.length < 200) {
      keywords.push(val);
    }
  }

  // Interaction payloads often have blockType or actionId
  if (typeof payload.interaction === "string") {
    keywords.push(payload.interaction);
  }

  return keywords;
}
