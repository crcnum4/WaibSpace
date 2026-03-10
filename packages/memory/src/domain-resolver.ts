/**
 * Determine which memory domains are relevant based on event context.
 */
export function resolveMemoryDomains(
  eventType: string,
  payload?: Record<string, unknown>,
  intentCategory?: string,
): string[] {
  const domains: string[] = ["global"];

  // Based on event type or intent
  if (eventType.includes("mail") || eventType.includes("email") || intentCategory === "email") {
    domains.push("email", "email:personal", "email:professional", "contacts");
  }
  if (eventType.includes("calendar") || intentCategory === "calendar") {
    domains.push("calendar");
  }
  if (eventType.includes("slack") || intentCategory === "slack" || intentCategory === "messaging") {
    domains.push("slack", "slack:work");
  }
  if (eventType.includes("github") || intentCategory === "code" || intentCategory === "development") {
    domains.push("github", "github:dev");
  }

  // system.poll events: derive from connectorId in payload
  if (eventType === "system.poll" && payload?.connectorId) {
    const connId = String(payload.connectorId).toLowerCase();
    if (connId.includes("mail") || connId.includes("gmail")) {
      domains.push("email", "contacts");
    }
    if (connId.includes("calendar")) {
      domains.push("calendar");
    }
  }

  return [...new Set(domains)]; // deduplicate
}
