import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
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
import type { CalendarEvent, FreeSlot } from "./types";

export interface GoogleCalendarConnectorConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

const BASE_CONFIG: BaseConnectorConfig = {
  id: "google-calendar",
  name: "Google Calendar",
  type: "api",
  trustLevel: "trusted",
  capabilities: {
    connectorId: "google-calendar",
    connectorType: "api",
    actions: [
      "list-events",
      "check-availability",
      "get-event",
      "create-event",
      "update-event",
    ],
    dataTypes: ["calendar-event", "free-slot"],
    trustLevel: "trusted",
  },
};

export class GoogleCalendarConnector extends BaseConnector {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar | null = null;
  private readonly oauthConfig: GoogleCalendarConnectorConfig;

  constructor(config: GoogleCalendarConnectorConfig) {
    super(BASE_CONFIG);
    this.oauthConfig = config;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
    this.oauth2Client.setCredentials({
      refresh_token: config.refreshToken,
    });
  }

  async connect(): Promise<void> {
    this.calendar = google.calendar({
      version: "v3",
      auth: this.oauth2Client,
    });
    this.connected = true;
    this.log("connected");
  }

  async disconnect(): Promise<void> {
    this.calendar = null;
    this.connected = false;
    this.log("disconnected");
  }

  protected override createProvenance(sourceId?: string) {
    return {
      sourceType: "google-calendar",
      sourceId: sourceId ?? this.id,
      trustLevel: this.trustLevel,
      timestamp: Date.now(),
      freshness: "realtime" as const,
      dataState: "raw" as const,
    };
  }

  protected async doFetch(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse> {
    const cal = this.getCalendar();

    switch (request.operation) {
      case "list-events":
        return this.listEvents(cal, request.params);
      case "check-availability":
        return this.checkAvailability(cal, request.params);
      case "get-event":
        return this.getEvent(cal, request.params);
      default:
        throw new Error(`Unknown fetch operation: ${request.operation}`);
    }
  }

  protected async doExecute(
    action: ConnectorAction,
  ): Promise<ConnectorResult> {
    const cal = this.getCalendar();

    switch (action.operation) {
      case "create-event":
        return this.createEvent(cal, action.params);
      case "update-event":
        return this.updateEvent(cal, action.params);
      default:
        throw new Error(`Unknown execute operation: ${action.operation}`);
    }
  }

  private getCalendar(): calendar_v3.Calendar {
    if (!this.calendar) {
      throw new Error("Calendar client not initialized. Call connect() first.");
    }
    return this.calendar;
  }

  // ── Fetch Operations (Class A) ──────────────────────────────────────

  private async listEvents(
    cal: calendar_v3.Calendar,
    params: Record<string, unknown>,
  ): Promise<ConnectorResponse> {
    const { timeMin, timeMax, calendarId, maxResults } = params as {
      timeMin: string;
      timeMax: string;
      calendarId?: string;
      maxResults?: number;
    };

    const res = await cal.events.list({
      calendarId: calendarId ?? "primary",
      timeMin,
      timeMax,
      maxResults: maxResults ?? 50,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events: CalendarEvent[] = (res.data.items ?? []).map(
      this.mapEvent,
    );

    return {
      data: events,
      provenance: this.createProvenance(),
    };
  }

  private async checkAvailability(
    cal: calendar_v3.Calendar,
    params: Record<string, unknown>,
  ): Promise<ConnectorResponse> {
    const { timeMin, timeMax } = params as {
      timeMin: string;
      timeMax: string;
    };

    const res = await cal.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items ?? [];
    const slots: FreeSlot[] = [];
    let cursor = new Date(timeMin).getTime();
    const end = new Date(timeMax).getTime();

    for (const event of events) {
      const eventStart = new Date(
        event.start?.dateTime ?? event.start?.date ?? "",
      ).getTime();
      const eventEnd = new Date(
        event.end?.dateTime ?? event.end?.date ?? "",
      ).getTime();

      if (eventStart > cursor) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(eventStart).toISOString(),
        });
      }
      if (eventEnd > cursor) {
        cursor = eventEnd;
      }
    }

    if (cursor < end) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(end).toISOString(),
      });
    }

    return {
      data: slots,
      provenance: this.createProvenance(),
    };
  }

  private async getEvent(
    cal: calendar_v3.Calendar,
    params: Record<string, unknown>,
  ): Promise<ConnectorResponse> {
    const { eventId, calendarId } = params as {
      eventId: string;
      calendarId?: string;
    };

    const res = await cal.events.get({
      calendarId: calendarId ?? "primary",
      eventId,
    });

    return {
      data: this.mapEvent(res.data),
      provenance: this.createProvenance(),
      raw: res.data,
    };
  }

  // ── Execute Operations (Class C) ───────────────────────────────────

  private async createEvent(
    cal: calendar_v3.Calendar,
    params: Record<string, unknown>,
  ): Promise<ConnectorResult> {
    const { summary, start, end, description, attendees, location } =
      params as {
        summary: string;
        start: string;
        end: string;
        description?: string;
        attendees?: string[];
        location?: string;
      };

    const res = await cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: start },
        end: { dateTime: end },
        attendees: attendees?.map((email) => ({ email })),
      },
    });

    return {
      success: true,
      result: this.mapEvent(res.data),
    };
  }

  private async updateEvent(
    cal: calendar_v3.Calendar,
    params: Record<string, unknown>,
  ): Promise<ConnectorResult> {
    const { eventId, updates } = params as {
      eventId: string;
      updates: Record<string, unknown>;
    };

    const requestBody: calendar_v3.Schema$Event = {};
    if (updates.summary !== undefined)
      requestBody.summary = updates.summary as string;
    if (updates.description !== undefined)
      requestBody.description = updates.description as string;
    if (updates.location !== undefined)
      requestBody.location = updates.location as string;
    if (updates.start !== undefined)
      requestBody.start = { dateTime: updates.start as string };
    if (updates.end !== undefined)
      requestBody.end = { dateTime: updates.end as string };
    if (updates.attendees !== undefined)
      requestBody.attendees = (updates.attendees as string[]).map(
        (email) => ({ email }),
      );

    const res = await cal.events.patch({
      calendarId: "primary",
      eventId,
      requestBody,
    });

    return {
      success: true,
      result: this.mapEvent(res.data),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private mapEvent(event: calendar_v3.Schema$Event): CalendarEvent {
    return {
      id: event.id ?? "",
      summary: event.summary ?? "",
      start:
        event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
      location: event.location ?? undefined,
      description: event.description ?? undefined,
      attendees: event.attendees
        ?.map((a: { email?: string | null }) => a.email ?? "")
        .filter(Boolean),
      status: event.status ?? "confirmed",
    };
  }
}
