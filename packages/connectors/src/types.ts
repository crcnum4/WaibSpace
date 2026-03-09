import type {
  ProvenanceMetadata,
  TrustLevel,
  ConnectorCapability,
  PolicyDecision,
} from "@waibspace/types";

export interface Connector {
  id: string;
  name: string;
  type: string; // "api", "mcp", "web-fetch"
  trustLevel: TrustLevel;
  capabilities: ConnectorCapability;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  fetch(request: ConnectorRequest): Promise<ConnectorResponse>;
  execute(action: ConnectorAction): Promise<ConnectorResult>;
}

export interface ConnectorRequest {
  operation: string;
  params: Record<string, unknown>;
  traceId: string;
}

export interface ConnectorResponse {
  data: unknown;
  provenance: ProvenanceMetadata;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ConnectorAction {
  operation: string;
  params: Record<string, unknown>;
  policyDecision: PolicyDecision;
  traceId: string;
}

export interface ConnectorResult {
  success: boolean;
  result?: unknown;
  error?: string;
}
