import {
  BaseConnector,
  type BaseConnectorConfig,
} from "../base-connector";
import type {
  ConnectorRequest,
  ConnectorResponse,
  ConnectorAction,
  ConnectorResult,
} from "../types";
import { extractReadableContent } from "./html-extractor";
import { RateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESPONSE_BYTES = 1_048_576; // 1 MB
const FETCH_TIMEOUT_MS = 10_000; // 10 s
const USER_AGENT = "WaibSpace/0.1";

// ---------------------------------------------------------------------------
// Robots.txt helper
// ---------------------------------------------------------------------------

interface RobotsRules {
  disallow: string[];
}

// ---------------------------------------------------------------------------
// WebFetchConnector
// ---------------------------------------------------------------------------

export class WebFetchConnector extends BaseConnector {
  private readonly rateLimiter = new RateLimiter();
  /** Cache of parsed robots.txt rules per domain. `null` = already fetched, no rules. */
  private readonly robotsCache = new Map<string, RobotsRules | null>();

  constructor(id: string, name: string) {
    const config: BaseConnectorConfig = {
      id,
      name,
      type: "web-fetch",
      trustLevel: "untrusted",
      capabilities: {
        connectorId: id,
        connectorType: "web-fetch",
        actions: ["fetch-url", "search-site"],
        dataTypes: ["text/html", "text/plain"],
        trustLevel: "untrusted",
      },
    };
    super(config);
  }

  // ---- lifecycle ----------------------------------------------------------

  async connect(): Promise<void> {
    this.connected = true;
    this.log("connected");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.log("disconnected");
  }

  // ---- read operations (Class A) -----------------------------------------

  protected async doFetch(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse> {
    switch (request.operation) {
      case "fetch-url":
        return this.fetchUrl(request);
      case "search-site":
        return this.searchSite(request);
      default:
        throw new Error(
          `Unknown operation "${request.operation}" for web-fetch connector`,
        );
    }
  }

  // ---- execute is always an error (read-only connector) -------------------

  protected async doExecute(
    _action: ConnectorAction,
  ): Promise<ConnectorResult> {
    return {
      success: false,
      error:
        "WebFetchConnector is read-only (Class A). It does not support execute actions.",
    };
  }

  // ---- fetch-url ----------------------------------------------------------

  private async fetchUrl(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse> {
    const { url, extractMode = "auto" } = request.params as {
      url: string;
      extractMode?: "html" | "text" | "auto";
    };

    if (!url || typeof url !== "string") {
      throw new Error('Parameter "url" is required and must be a string');
    }

    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;

    // Rate-limit check
    const rateCheck = this.rateLimiter.check(domain);
    if (!rateCheck.allowed) {
      throw new Error(
        `Rate limited for domain "${domain}". Retry after ${rateCheck.retryAfterMs} ms.`,
      );
    }

    // Robots.txt check
    await this.ensureRobotsFetched(domain, parsedUrl.protocol);
    if (this.isDisallowedByRobots(domain, parsedUrl.pathname)) {
      throw new Error(
        `Path "${parsedUrl.pathname}" is disallowed by robots.txt for domain "${domain}"`,
      );
    }

    // Perform the fetch
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") ?? "unknown";
    const rawBody = await this.readBodyLimited(response);

    const isHtml = contentType.includes("text/html");
    const mode =
      extractMode === "auto" ? (isHtml ? "html" : "text") : extractMode;

    let title = "";
    let content: string;

    if (mode === "html") {
      const extracted = extractReadableContent(rawBody);
      title = extracted.title;
      content = extracted.content;
    } else {
      content =
        rawBody.length > 10_000 ? rawBody.slice(0, 10_000) + "..." : rawBody;
    }

    return {
      data: {
        title,
        content,
        url,
        statusCode: response.status,
        contentType,
      },
      provenance: this.createProvenance(this.id),
      raw: rawBody,
    };
  }

  // ---- search-site --------------------------------------------------------

  private async searchSite(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse> {
    const { domain, query } = request.params as {
      domain: string;
      query: string;
    };

    if (!domain || typeof domain !== "string") {
      throw new Error('Parameter "domain" is required and must be a string');
    }
    if (!query || typeof query !== "string") {
      throw new Error('Parameter "query" is required and must be a string');
    }

    const rootUrl = `https://${domain}/`;

    // Rate-limit check
    const rateCheck = this.rateLimiter.check(domain);
    if (!rateCheck.allowed) {
      throw new Error(
        `Rate limited for domain "${domain}". Retry after ${rateCheck.retryAfterMs} ms.`,
      );
    }

    // Robots.txt check for root
    await this.ensureRobotsFetched(domain, "https:");
    if (this.isDisallowedByRobots(domain, "/")) {
      throw new Error(
        `Root path is disallowed by robots.txt for domain "${domain}"`,
      );
    }

    let html: string;
    try {
      const response = await fetch(rootUrl, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      html = await this.readBodyLimited(response);
    } catch {
      return {
        data: [],
        provenance: this.createProvenance(this.id),
      };
    }

    const extracted = extractReadableContent(html);
    const queryLower = query.toLowerCase();

    // Build result set from extracted links
    const results: Array<{ url: string; title: string; snippet: string }> = [];
    const seen = new Set<string>();

    for (const href of extracted.links) {
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, rootUrl).toString();
      } catch {
        continue;
      }

      if (seen.has(absoluteUrl)) continue;
      seen.add(absoluteUrl);

      // Best-effort relevance: check if the link text or URL contains query terms
      const hrefLower = absoluteUrl.toLowerCase();
      if (
        hrefLower.includes(queryLower) ||
        extracted.content.toLowerCase().includes(queryLower)
      ) {
        results.push({
          url: absoluteUrl,
          title: this.guessTitleFromUrl(absoluteUrl),
          snippet: "",
        });
      }
    }

    return {
      data: results,
      provenance: this.createProvenance(this.id),
    };
  }

  // ---- helpers ------------------------------------------------------------

  /**
   * Read the response body up to MAX_RESPONSE_BYTES, truncating if larger.
   */
  private async readBodyLimited(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";

    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        // Take only the portion that fits
        const excess = totalBytes - MAX_RESPONSE_BYTES;
        const trimmed = value.slice(0, value.byteLength - excess);
        chunks.push(decoder.decode(trimmed, { stream: false }));
        // Cancel the rest of the stream
        await reader.cancel();
        break;
      }

      chunks.push(decoder.decode(value, { stream: true }));
    }

    return chunks.join("");
  }

  /**
   * Fetch and cache robots.txt for a domain (first visit only).
   */
  private async ensureRobotsFetched(
    domain: string,
    protocol: string,
  ): Promise<void> {
    if (this.robotsCache.has(domain)) return;

    try {
      const robotsUrl = `${protocol}//${domain}/robots.txt`;
      const response = await fetch(robotsUrl, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });

      if (!response.ok) {
        // No robots.txt or error — allow everything
        this.robotsCache.set(domain, null);
        return;
      }

      const text = await response.text();
      const rules = this.parseRobotsTxt(text);
      this.robotsCache.set(domain, rules);
    } catch {
      // Network error — allow everything
      this.robotsCache.set(domain, null);
    }
  }

  /**
   * Basic robots.txt parser. Extracts Disallow rules for User-agent: * or
   * User-agent: WaibSpace.
   */
  private parseRobotsTxt(text: string): RobotsRules {
    const lines = text.split("\n");
    const disallow: string[] = [];
    let active = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("#") || line === "") continue;

      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();

      if (key.toLowerCase() === "user-agent") {
        active = value === "*" || value.toLowerCase().startsWith("waibspace");
      } else if (active && key.toLowerCase() === "disallow" && value) {
        disallow.push(value);
      }
    }

    return { disallow };
  }

  /**
   * Check whether a path is disallowed by cached robots.txt rules.
   */
  private isDisallowedByRobots(domain: string, pathname: string): boolean {
    const rules = this.robotsCache.get(domain);
    if (!rules) return false;

    return rules.disallow.some((pattern) => pathname.startsWith(pattern));
  }

  /**
   * Derive a human-readable title from a URL path.
   */
  private guessTitleFromUrl(url: string): string {
    try {
      const { pathname } = new URL(url);
      const segments = pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1] ?? "";
      return decodeURIComponent(last).replace(/[-_]/g, " ") || url;
    } catch {
      return url;
    }
  }

  // ---- provenance override ------------------------------------------------

  protected override createProvenance(sourceId?: string) {
    return {
      sourceType: "web-fetch",
      sourceId: sourceId ?? this.id,
      trustLevel: "untrusted" as const,
      timestamp: Date.now(),
      freshness: "realtime" as const,
      dataState: "raw" as const,
    };
  }
}
