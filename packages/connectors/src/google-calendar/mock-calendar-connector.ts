import { BaseConnector } from "../base-connector";
import type {
  ConnectorRequest,
  ConnectorResponse,
  ConnectorAction,
  ConnectorResult,
} from "../types";
import type { CalendarEvent } from "./types";
import { FIXTURE_EVENTS, computeFreeSlots } from "./fixtures";

/**
 * Mock Google Calendar connector that returns fixture data.
 * Activated when `MOCK_CONNECTORS=true` is set in the environment.
 */
export class MockCalendarConnector extends BaseConnector {
  private events: CalendarEvent[] = [];

  constructor() {
    super({
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
    });
  }

  async connect(): Promise<void> {
    this.events = [...FIXTURE_EVENTS];
    this.connected = true;
    this.log("Connected (mock mode — using fixture data)");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.log("Disconnected (mock)");
  }

  protected override createProvenance() {
    return {
      sourceType: "google-calendar",
      sourceId: this.id,
      trustLevel: this.trustLevel,
      timestamp: Date.now(),
      freshness: "realtime" as const,
      dataState: "raw" as const,
    };
  }

  protected async doFetch(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse> {
    switch (request.operation) {
      case "list-events":
        return this.listEvents(request.params);
      case "check-availability":
        return this.checkAvailability(request.params);
      case "get-event":
        return this.getEvent(request.params);
      default:
        throw new Error(`Unknown fetch operation: ${request.operation}`);
    }
  }

  protected async doExecute(
    action: ConnectorAction,
  ): Promise<ConnectorResult> {
    switch (action.operation) {
      case "create-event":
        return {
          success: true,
          result: {
            id: `mock-evt-${Date.now()}`,
            ...(action.params as Record<string, unknown>),
            status: "confirmed",
          },
        };
      case "update-event":
        return {
          success: true,
          result: { eventId: action.params.eventId, updated: true },
        };
      default:
        return {
          success: false,
          error: `Unknown execute operation: ${action.operation}`,
        };
    }
  }

  private async listEvents(
    params: Record<string, unknown>,
  ): Promise<ConnectorResponse> {
    const { timeMin, timeMax, maxResults } = params as {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
    };

    let results = [...this.events];

    if (timeMin) {
      const min = new Date(timeMin).getTime();
      results = results.filter(
        (e) => new Date(e.end).getTime() >= min,
      );
    }
    if (timeMax) {
      const max = new Date(timeMax).getTime();
      results = results.filter(
        (e) => new Date(e.start).getTime() <= max,
      );
    }

    results.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    if (maxResults) {
      results = results.slice(0, maxResults);
    }

    return {
      data: results,
      provenance: this.createProvenance(),
    };
  }

  private async checkAvailability(
    params: Record<string, unknown>,
  ): Promise<ConnectorResponse> {
    const { timeMin, timeMax } = params as {
      timeMin: string;
      timeMax: string;
    };

    const slots = computeFreeSlots(this.events, timeMin, timeMax);

    return {
      data: slots,
      provenance: this.createProvenance(),
    };
  }

  private async getEvent(
    params: Record<string, unknown>,
  ): Promise<ConnectorResponse> {
    const { eventId } = params as { eventId: string };
    const event = this.events.find((e) => e.id === eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    return {
      data: event,
      provenance: this.createProvenance(),
    };
  }
}
