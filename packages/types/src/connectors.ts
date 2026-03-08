import type { TrustLevel } from "./provenance";

export interface ConnectorCapability {
  connectorId: string;
  connectorType: string;
  actions: string[];
  dataTypes: string[];
  trustLevel: TrustLevel;
}
