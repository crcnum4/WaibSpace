import { BaseConnector } from "../base-connector";
import type { ConnectorRequest, ConnectorResponse, ConnectorAction, ConnectorResult } from "../types";
import type {
  EmailSummary,
  ListEmailsParams,
  GetEmailParams,
  SearchEmailsParams,
} from "./types";
import { FIXTURE_EMAILS, FIXTURE_BODIES } from "./fixtures";

/**
 * Mock Gmail connector that returns fixture data.
 * Activated when `MOCK_CONNECTORS=true` is set in the environment.
 */
export class MockGmailConnector extends BaseConnector {
  private emails: EmailSummary[] = [];

  constructor() {
    super({
      id: "gmail",
      name: "Gmail",
      type: "api",
      trustLevel: "trusted",
      capabilities: {
        connectorId: "gmail",
        connectorType: "api",
        actions: ["list-emails", "get-email", "search-emails", "get-inbox-stats", "create-draft", "send-email"],
        dataTypes: ["email"],
        trustLevel: "trusted",
      },
    });
  }

  async connect(): Promise<void> {
    this.emails = [...FIXTURE_EMAILS];
    this.connected = true;
    this.log("Connected (mock mode — using fixture data)");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.log("Disconnected (mock)");
  }

  protected override createProvenance() {
    return {
      sourceType: "gmail",
      sourceId: this.id,
      trustLevel: this.trustLevel,
      timestamp: Date.now(),
      freshness: "realtime" as const,
      dataState: "raw" as const,
    };
  }

  protected async doFetch(request: ConnectorRequest): Promise<ConnectorResponse> {
    switch (request.operation) {
      case "list-emails":
        return this.listEmails(request.params as unknown as ListEmailsParams);
      case "get-email":
        return this.getEmail(request.params as unknown as GetEmailParams);
      case "search-emails":
        return this.searchEmails(request.params as unknown as SearchEmailsParams);
      case "get-inbox-stats":
        return this.getInboxStats();
      default:
        throw new Error(`Unknown fetch operation: ${request.operation}`);
    }
  }

  protected async doExecute(action: ConnectorAction): Promise<ConnectorResult> {
    switch (action.operation) {
      case "create-draft":
        return {
          success: true,
          result: { draftId: `mock-draft-${Date.now()}` },
        };
      case "send-email":
        return {
          success: true,
          result: { messageId: `mock-msg-${Date.now()}`, threadId: `mock-thread-${Date.now()}` },
        };
      default:
        return { success: false, error: `Unknown execute operation: ${action.operation}` };
    }
  }

  // ── Fetch operations ──────────────────────────────────────

  private async listEmails(params: ListEmailsParams): Promise<ConnectorResponse> {
    let results = [...this.emails];

    // Filter by query keywords (simple substring match on subject/snippet/from)
    if (params.query && params.query !== "is:unread") {
      const q = params.query.toLowerCase();
      if (q === "is:unread") {
        results = results.filter((e) => e.isUnread);
      } else {
        results = results.filter(
          (e) =>
            e.subject.toLowerCase().includes(q) ||
            e.snippet.toLowerCase().includes(q) ||
            e.from.toLowerCase().includes(q),
        );
      }
    } else if (params.query === "is:unread") {
      results = results.filter((e) => e.isUnread);
    }

    // Filter by label
    if (params.labelIds?.length) {
      results = results.filter((e) =>
        params.labelIds!.some((label) => e.labels.includes(label)),
      );
    }

    const maxResults = params.maxResults ?? 10;
    results = results.slice(0, maxResults);

    const totalUnread = this.emails.filter((e) => e.isUnread).length;

    return {
      data: results,
      provenance: this.createProvenance(),
      metadata: { totalUnread },
    };
  }

  private async getEmail(params: GetEmailParams): Promise<ConnectorResponse> {
    const email = this.emails.find((e) => e.id === params.emailId);
    if (!email) {
      throw new Error(`Email not found: ${params.emailId}`);
    }

    const body = FIXTURE_BODIES[email.id] ?? email.snippet;

    return {
      data: { ...email, body },
      provenance: this.createProvenance(),
    };
  }

  private async searchEmails(params: SearchEmailsParams): Promise<ConnectorResponse> {
    return this.listEmails({
      query: params.query,
      maxResults: params.maxResults,
    });
  }

  private async getInboxStats(): Promise<ConnectorResponse> {
    const total = this.emails.length;
    const unread = this.emails.filter((e) => e.isUnread).length;
    const threads = new Set(this.emails.map((e) => e.threadId)).size;
    const unreadThreads = new Set(
      this.emails.filter((e) => e.isUnread).map((e) => e.threadId),
    ).size;

    return {
      data: {
        messagesTotal: total,
        messagesUnread: unread,
        threadsTotal: threads,
        threadsUnread: unreadThreads,
      },
      provenance: this.createProvenance(),
    };
  }
}
