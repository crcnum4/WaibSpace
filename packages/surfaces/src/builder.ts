import type {
  SurfaceSpec,
  SurfaceAction,
  SurfaceAffordance,
  LayoutHints,
  ProvenanceMetadata,
} from "@waibspace/types";

export class SurfaceSpecBuilder {
  private spec: Partial<SurfaceSpec>;

  constructor(surfaceType: string) {
    this.spec = {
      surfaceType,
      surfaceId: crypto.randomUUID(),
      actions: [],
      affordances: [],
      layoutHints: {},
      confidence: 1,
    };
  }

  setTitle(title: string): this {
    this.spec.title = title;
    return this;
  }

  setSummary(summary: string): this {
    this.spec.summary = summary;
    return this;
  }

  setPriority(priority: number): this {
    this.spec.priority = priority;
    return this;
  }

  setData(data: unknown): this {
    this.spec.data = data;
    return this;
  }

  addAction(action: SurfaceAction): this {
    this.spec.actions!.push(action);
    return this;
  }

  addAffordance(affordance: SurfaceAffordance): this {
    this.spec.affordances!.push(affordance);
    return this;
  }

  setLayout(hints: LayoutHints): this {
    this.spec.layoutHints = hints;
    return this;
  }

  setProvenance(provenance: ProvenanceMetadata): this {
    this.spec.provenance = provenance;
    return this;
  }

  setConfidence(confidence: number): this {
    this.spec.confidence = confidence;
    return this;
  }

  build(): SurfaceSpec {
    if (!this.spec.title) {
      throw new Error("SurfaceSpec requires a title");
    }
    if (!this.spec.provenance) {
      throw new Error("SurfaceSpec requires provenance metadata");
    }
    if (this.spec.priority === undefined) {
      throw new Error("SurfaceSpec requires a priority");
    }
    if (this.spec.data === undefined) {
      throw new Error("SurfaceSpec requires data");
    }

    return this.spec as SurfaceSpec;
  }
}
