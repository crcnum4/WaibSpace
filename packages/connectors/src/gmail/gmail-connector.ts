import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "googleapis-common";
import { BaseConnector } from "../base-connector";
import type { ConnectorRequest, ConnectorResponse, ConnectorAction, ConnectorResult } from "../types";
import type {
  EmailSummary,
  ListEmailsParams,
  GetEmailParams,
  SearchEmailsParams,
  CreateDraftParams,
  SendEmailParams,
} from "./types";

function getGmailClient(): { gmail: gmail_v1.Gmail; auth: OAuth2Client } {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail credentials not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN environment variables.",
    );
  }

  const auth = new OAuth2Client(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });

  return { gmail, auth };
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function messageToSummary(msg: gmail_v1.Schema$Message): EmailSummary {
  const headers = msg.payload?.headers;
  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    snippet: msg.snippet ?? "",
    date: getHeader(headers, "Date"),
    labels: msg.labelIds ?? [],
    isUnread: msg.labelIds?.includes("UNREAD") ?? false,
  };
}

function encodeEmail(to: string, subject: string, body: string, inReplyTo?: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${inReplyTo}`);
  }
  lines.push("", body);
  const raw = lines.join("\r\n");
  return Buffer.from(raw).toString("base64url");
}

export class GmailConnector extends BaseConnector {
  private gmail: gmail_v1.Gmail | null = null;
  private configured = false;

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
    try {
      const client = getGmailClient();
      this.gmail = client.gmail;
      this.configured = true;
      this.connected = true;
      this.log("Connected to Gmail API");
    } catch (err) {
      this.configured = false;
      this.connected = false;
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Warning: Gmail not configured — ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.gmail = null;
    this.connected = false;
    this.log("Disconnected from Gmail API");
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
    if (!this.gmail || !this.configured) {
      throw new Error("Gmail client is not configured. Call connect() first and ensure credentials are set.");
    }

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
    if (!this.gmail || !this.configured) {
      return {
        success: false,
        error: "Gmail client is not configured. Call connect() first and ensure credentials are set.",
      };
    }

    try {
      switch (action.operation) {
        case "create-draft":
          return this.createDraft(action.params as unknown as CreateDraftParams);
        case "send-email":
          return this.sendEmail(action.params as unknown as SendEmailParams);
        default:
          return { success: false, error: `Unknown execute operation: ${action.operation}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Gmail API error: ${message}` };
    }
  }

  // --- Fetch Operations (Class A) ---

  private async listEmails(params: ListEmailsParams): Promise<ConnectorResponse> {
    const query = params.query ?? "is:unread";
    const res = await this.gmail!.users.messages.list({
      userId: "me",
      maxResults: params.maxResults ?? 10,
      q: query,
      labelIds: params.labelIds,
    });

    const messages = res.data.messages ?? [];
    const summaries = await Promise.all(
      messages.map((m) => this.fetchMessageSummary(m.id!)),
    );

    // Fetch total unread count from INBOX label stats
    let totalUnread: number | undefined;
    try {
      const labelRes = await this.gmail!.users.labels.get({
        userId: "me",
        id: "INBOX",
      });
      totalUnread = labelRes.data.messagesUnread ?? undefined;
    } catch {
      // Non-critical — continue without total unread count
    }

    return {
      data: summaries,
      provenance: this.createProvenance(),
      raw: res.data,
      metadata: { totalUnread },
    };
  }

  private async getEmail(params: GetEmailParams): Promise<ConnectorResponse> {
    const res = await this.gmail!.users.messages.get({
      userId: "me",
      id: params.emailId,
      format: "full",
    });

    const summary = messageToSummary(res.data);
    const body = this.extractBody(res.data);

    return {
      data: { ...summary, body },
      provenance: this.createProvenance(),
      raw: res.data,
    };
  }

  private async searchEmails(params: SearchEmailsParams): Promise<ConnectorResponse> {
    return this.listEmails({
      query: params.query,
      maxResults: params.maxResults,
    });
  }

  private async getInboxStats(): Promise<ConnectorResponse> {
    const labelRes = await this.gmail!.users.labels.get({
      userId: "me",
      id: "INBOX",
    });

    return {
      data: {
        messagesTotal: labelRes.data.messagesTotal ?? 0,
        messagesUnread: labelRes.data.messagesUnread ?? 0,
        threadsTotal: labelRes.data.threadsTotal ?? 0,
        threadsUnread: labelRes.data.threadsUnread ?? 0,
      },
      provenance: this.createProvenance(),
      raw: labelRes.data,
    };
  }

  // --- Execute Operations (Class C) ---

  private async createDraft(params: CreateDraftParams): Promise<ConnectorResult> {
    const raw = encodeEmail(params.to, params.subject, params.body, params.inReplyTo);

    const res = await this.gmail!.users.drafts.create({
      userId: "me",
      requestBody: {
        message: { raw },
      },
    });

    return {
      success: true,
      result: { draftId: res.data.id },
    };
  }

  private async sendEmail(params: SendEmailParams): Promise<ConnectorResult> {
    if (params.draftId) {
      const res = await this.gmail!.users.drafts.send({
        userId: "me",
        requestBody: { id: params.draftId },
      });
      return {
        success: true,
        result: { messageId: res.data.id, threadId: res.data.threadId },
      };
    }

    if (!params.to || !params.subject || !params.body) {
      return {
        success: false,
        error: "send-email requires either draftId or (to, subject, body)",
      };
    }

    const raw = encodeEmail(params.to, params.subject, params.body);
    const res = await this.gmail!.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return {
      success: true,
      result: { messageId: res.data.id, threadId: res.data.threadId },
    };
  }

  // --- Helpers ---

  private async fetchMessageSummary(messageId: string): Promise<EmailSummary> {
    const res = await this.gmail!.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    });
    return messageToSummary(res.data);
  }

  private extractBody(message: gmail_v1.Schema$Message): string {
    const payload = message.payload;
    if (!payload) return "";

    // Simple single-part message
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }

    // Multipart: look for text/plain first, then text/html
    const parts = payload.parts ?? [];
    const textPart = parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf-8");
    }

    const htmlPart = parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, "base64url").toString("utf-8");
    }

    return "";
  }
}
