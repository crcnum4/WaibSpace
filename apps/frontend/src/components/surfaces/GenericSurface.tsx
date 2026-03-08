import type { SurfaceProps } from "./registry";
import { ProvenanceBadge } from "../ProvenanceBadge";

export function GenericSurface({ spec, onAction }: SurfaceProps) {
  return (
    <div className="surface generic-surface">
      <div className="surface-header">
        <div className="surface-header-top">
          <h3>{spec.title}</h3>
          <ProvenanceBadge provenance={spec.provenance} />
        </div>
        {spec.summary && <p className="surface-summary">{spec.summary}</p>}
      </div>
      <div className="surface-content">
        <pre>{JSON.stringify(spec.data, null, 2)}</pre>
      </div>
      {spec.actions.length > 0 && (
        <div className="surface-actions">
          {spec.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action)}
              className={`action-btn risk-${action.riskClass}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
