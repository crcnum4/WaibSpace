import type {
  ProvenanceMetadata,
  TrustLevel,
  ConnectorCapability,
} from "@waibspace/types";
import type {
  Connector,
  ConnectorRequest,
  ConnectorResponse,
  ConnectorAction,
  ConnectorResult,
} from "./types";

export interface BaseConnectorConfig {
  id: string;
  name: string;
  type: string;
  trustLevel: TrustLevel;
  capabilities: ConnectorCapability;
}

export abstract class BaseConnector implements Connector {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly trustLevel: TrustLevel;
  readonly capabilities: ConnectorCapability;
  protected connected = false;

  constructor(config: BaseConnectorConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.trustLevel = config.trustLevel;
    this.capabilities = config.capabilities;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  async fetch(request: ConnectorRequest): Promise<ConnectorResponse> {
    if (!this.connected) {
      throw new Error(`Connector "${this.name}" (${this.id}) is not connected`);
    }

    this.log(`fetch: ${request.operation}`, {
      traceId: request.traceId,
      params: request.params,
    });

    const response = await this.doFetch(request);

    // Attach provenance metadata if not already set
    if (!response.provenance) {
      response.provenance = this.createProvenance(this.id);
    }

    return response;
  }

  async execute(action: ConnectorAction): Promise<ConnectorResult> {
    // Verify policy decision is approved
    if (action.policyDecision.verdict !== "approved") {
      return {
        success: false,
        error: `Action "${action.operation}" rejected by policy: ${action.policyDecision.reason} (verdict: ${action.policyDecision.verdict})`,
      };
    }

    if (!this.connected) {
      throw new Error(`Connector "${this.name}" (${this.id}) is not connected`);
    }

    this.log(`execute: ${action.operation}`, {
      traceId: action.traceId,
      params: action.params,
      riskClass: action.policyDecision.riskClass,
    });

    return this.doExecute(action);
  }

  protected abstract doFetch(
    request: ConnectorRequest,
  ): Promise<ConnectorResponse>;

  protected abstract doExecute(
    action: ConnectorAction,
  ): Promise<ConnectorResult>;

  protected createProvenance(sourceId?: string): ProvenanceMetadata {
    return {
      sourceType: this.type,
      sourceId: sourceId ?? this.id,
      trustLevel: this.trustLevel,
      timestamp: Date.now(),
      freshness: "realtime",
      dataState: "raw",
    };
  }

  protected log(message: string, data?: unknown): void {
    const prefix = `[${this.type}:${this.name}]`;
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
}
