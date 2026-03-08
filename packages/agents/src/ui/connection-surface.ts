import type { AgentOutput } from "@waibspace/types";
import {
  SurfaceFactory,
  type ConnectionGuideSurfaceData,
} from "@waibspace/surfaces";
import {
  MCP_SERVER_CATALOG,
  findTemplate,
} from "@waibspace/connectors";
import { BaseAgent } from "../base-agent";
import type { AgentInput, AgentContext } from "../types";
import type { IntentClassification } from "../reasoning/intent-agent";

export class ConnectionSurfaceAgent extends BaseAgent {
  constructor() {
    super({
      id: "ui.connection-surface",
      name: "ConnectionSurfaceAgent",
      type: "surface-builder",
      category: "ui",
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    const startMs = Date.now();

    const intent = this.findIntentClassification(input);

    // Only produce a surface if the intent is connection-related
    // or if this is a service selection interaction
    const isConnectionIntent = intent?.intentCategory === "connection";
    const isServiceSelection = this.isServiceSelectionEvent(input);

    if (!isConnectionIntent && !isServiceSelection) {
      // Return empty output — this agent has nothing to contribute
      return this.createEmptyOutput(startMs);
    }

    // Determine which service the user wants
    const serviceId = this.identifyService(intent, input);

    let surfaceData: ConnectionGuideSurfaceData;

    if (serviceId) {
      const template = findTemplate(serviceId);
      if (template) {
        // Found in catalog — show credentials step
        surfaceData = {
          step: "credentials",
          message: template.requiredCredentials.length > 0
            ? `To connect ${template.name}, you'll need to provide the following credentials. Click the help links if you need guidance getting them.`
            : `${template.name} doesn't require any credentials. Click Connect to set it up!`,
          availableServices: this.catalogToServices(),
          selectedService: {
            id: template.id,
            name: template.name,
            icon: template.icon,
            description: template.description,
          },
          credentialFields: template.requiredCredentials.map((c) => ({
            key: c.key,
            label: c.label,
            helpText: c.helpText,
            helpUrl: c.helpUrl,
            sensitive: c.sensitive,
          })),
        };
        this.log("Producing credentials step", { service: template.id, credCount: template.requiredCredentials.length });
      } else {
        // Not in catalog — show browse with suggestion
        surfaceData = {
          step: "browse",
          message: `I don't have "${serviceId}" in my catalog yet. You can add it manually in Settings, or pick from one of these available services:`,
          availableServices: this.catalogToServices(),
        };
        this.log("Service not found in catalog", { query: serviceId });
      }
    } else {
      // No specific service — show catalog browser
      surfaceData = {
        step: "browse",
        message: "Which service would you like to connect? Pick one below, or tell me what you're looking for.",
        availableServices: this.catalogToServices(),
      };
      this.log("Showing catalog browser");
    }

    const endMs = Date.now();

    const provenance = {
      sourceType: "agent" as const,
      sourceId: this.id,
      trustLevel: "trusted" as const,
      timestamp: startMs,
      freshness: "realtime" as const,
      dataState: "transformed" as const,
      transformations: ["catalog-lookup"],
    };

    const surfaceSpec = SurfaceFactory.connectionGuide(surfaceData, provenance);

    return {
      ...this.createOutput(
        { surfaceSpec },
        0.9,
        provenance,
      ),
      timing: {
        startMs,
        endMs,
        durationMs: endMs - startMs,
      },
    };
  }

  private findIntentClassification(input: AgentInput): IntentClassification | undefined {
    for (const prior of input.priorOutputs) {
      if (prior.category === "reasoning" && prior.output) {
        const output = prior.output as Record<string, unknown>;
        if ("primaryIntent" in output && "intentCategory" in output) {
          return output as unknown as IntentClassification;
        }
      }
    }
    return undefined;
  }

  private isServiceSelectionEvent(input: AgentInput): boolean {
    const payload = input.event.payload as Record<string, unknown> | undefined;
    return payload?.interaction === "select-service";
  }

  private identifyService(
    intent: IntentClassification | undefined,
    input: AgentInput,
  ): string | undefined {
    // 1. Check interaction event payload (service selection)
    const payload = input.event.payload as Record<string, unknown> | undefined;
    if (payload?.interaction === "select-service") {
      const target = payload.target as string | undefined;
      const ctx = payload.context as Record<string, unknown> | undefined;
      return target || (ctx?.service as string) || undefined;
    }

    // 2. Check intent entities
    if (intent?.entities?.service) {
      return intent.entities.service;
    }

    // 3. Try to extract from the raw text
    if (intent?.primaryIntent === "connect_service" && intent?.reasoning) {
      // The reasoning may mention the service name
      const text = (payload?.text as string) || intent.reasoning;
      const lower = text.toLowerCase();

      // Quick keyword checks
      const keywords = ["gmail", "email", "google", "slack", "github", "drive", "search", "filesystem", "files", "brave", "memory"];
      for (const kw of keywords) {
        if (lower.includes(kw)) return kw;
      }
    }

    return undefined;
  }

  private catalogToServices(): ConnectionGuideSurfaceData["availableServices"] {
    return MCP_SERVER_CATALOG.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      categories: t.categories,
    }));
  }

  private createEmptyOutput(startMs: number): AgentOutput {
    const endMs = Date.now();
    return {
      ...this.createOutput(null, 0),
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }
}
