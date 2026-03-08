import type { TrustLevel, ConnectorCapability } from "@waibspace/types";
import type { Connector } from "./types";

export class ConnectorRegistry {
  private connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    if (this.connectors.has(connector.id)) {
      throw new Error(
        `Connector with id "${connector.id}" is already registered`,
      );
    }
    this.connectors.set(connector.id, connector);
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getByType(type: string): Connector[] {
    return Array.from(this.connectors.values()).filter(
      (c) => c.type === type,
    );
  }

  getByTrustLevel(level: TrustLevel): Connector[] {
    return Array.from(this.connectors.values()).filter(
      (c) => c.trustLevel === level,
    );
  }

  getAll(): Connector[] {
    return Array.from(this.connectors.values());
  }

  listCapabilities(): ConnectorCapability[] {
    return Array.from(this.connectors.values()).map((c) => c.capabilities);
  }
}
