import type { AgentOutput } from "@waibspace/types";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";

export interface URLIntentParsed {
  host: string | null;
  pathSegments: string[];
  intentQuery: string;
  hasExternalTarget: boolean;
}

export class URLIntentParserAgent extends BaseAgent {
  constructor() {
    super({
      id: "perception.url-intent-parser",
      name: "URLIntentParser",
      type: "url-intent-parser",
      category: "perception",
    });
  }

  async execute(input: AgentInput, _context: AgentContext): Promise<AgentOutput> {
    const { event } = input;
    const payload = event.payload as Record<string, unknown> | undefined;
    const startMs = Date.now();

    const rawContent = this.extractContent(input);
    const parsed = this.parse(rawContent);

    this.log("Parsed URL intent", {
      host: parsed.host,
      hasExternalTarget: parsed.hasExternalTarget,
      segments: parsed.pathSegments.length,
    });

    return this.createOutput(parsed, parsed.host ? 0.9 : 0.7, {
      relatedEventId: event.id,
      dataState: "transformed",
      transformations: ["url-intent-parsing"],
      timestamp: startMs,
    });
  }

  private extractContent(input: AgentInput): string {
    const payload = input.event.payload as Record<string, unknown> | undefined;

    // Try to use normalized content from a prior InputNormalizerAgent output
    for (const prior of input.priorOutputs) {
      const out = prior.output as Record<string, unknown> | undefined;
      if (out && typeof out.normalizedContent === "string") {
        return out.normalizedContent;
      }
    }

    // Fall back to payload fields
    if (payload) {
      if (typeof payload.path === "string") return payload.path;
      if (typeof payload.url === "string") return payload.url;
      if (typeof payload.text === "string") return payload.text;
    }

    return "";
  }

  private parse(raw: string): URLIntentParsed {
    if (!raw || !raw.trim()) {
      return { host: null, pathSegments: [], intentQuery: "", hasExternalTarget: false };
    }

    const trimmed = raw.trim();

    // Strip protocol if present
    let withoutProtocol = trimmed;
    const protocolMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.exec(trimmed);
    if (protocolMatch) {
      withoutProtocol = trimmed.slice(protocolMatch[0].length);
    }

    // Try to detect host vs bare path
    let host: string | null = null;
    let pathPart = withoutProtocol;

    // A hostname has dots and the first segment looks like a domain (no spaces, has a dot)
    const slashIndex = withoutProtocol.indexOf("/");
    const possibleHost = slashIndex >= 0 ? withoutProtocol.slice(0, slashIndex) : withoutProtocol;

    if (this.looksLikeHostname(possibleHost)) {
      host = possibleHost.toLowerCase();
      pathPart = slashIndex >= 0 ? withoutProtocol.slice(slashIndex) : "";
    }

    // Strip query string and fragment
    pathPart = pathPart.split("?")[0].split("#")[0];

    // Split path into segments, splitting on /, -, and _
    const pathSegments = pathPart
      .split(/[/\-_]/)
      .map((s) => decodeURIComponent(s).trim())
      .filter(Boolean);

    // Build human-readable intent query from segments
    const intentQuery = pathSegments.join(" ");

    return {
      host,
      pathSegments,
      intentQuery,
      hasExternalTarget: host !== null,
    };
  }

  private looksLikeHostname(value: string): boolean {
    if (!value || value.includes(" ")) return false;
    // Must contain at least one dot and no spaces
    if (!value.includes(".")) return false;
    // Basic domain-like pattern: segments separated by dots, optional port
    const withoutPort = value.split(":")[0];
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(
      withoutPort,
    );
  }
}
