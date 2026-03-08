import type { SurfaceProps } from "./registry";
import type { ApprovalSurfaceData } from "@waibspace/surfaces";

const riskColors: Record<string, string> = {
  A: "#22c55e",
  B: "#eab308",
  C: "#ef4444",
};

const riskLabels: Record<string, string> = {
  A: "Low Risk",
  B: "Medium Risk",
  C: "High Risk",
};

export function ApprovalSurface({
  spec,
  onAction,
  onInteraction,
}: SurfaceProps) {
  const data = spec.data as ApprovalSurfaceData;

  const handleApprove = () => {
    // Emit approval.response via the onInteraction callback
    // The HomePage will detect the "approve" interaction on an approval surface
    // and send an approval.response message
    onInteraction("approve", data.approvalId, { approved: true });
  };

  const handleDeny = () => {
    onInteraction("deny", data.approvalId, { approved: false });
  };

  return (
    <div className="approval-overlay">
      <div className="approval-backdrop" />
      <div className="approval-modal">
        <div className="approval-header">
          <h3>Action Approval Required</h3>
          <span
            className="approval-risk-badge"
            style={{ background: riskColors[data.riskClass] || riskColors.B }}
          >
            {riskLabels[data.riskClass] || data.riskClass}
          </span>
        </div>
        <div className="approval-description">
          <span className="approval-label">WaibSpace wants to:</span>
          <p className="approval-action-text">{data.actionDescription}</p>
        </div>
        {data.context != null && (
          <div className="approval-context">
            <span className="approval-label">Context</span>
            <pre>{JSON.stringify(data.context, null, 2)}</pre>
          </div>
        )}
        {data.consequences.length > 0 && (
          <div className="approval-consequences">
            <span className="approval-label">Consequences</span>
            <ul>
              {data.consequences.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="approval-buttons">
          <button className="approval-btn approve" onClick={handleApprove}>
            Approve
          </button>
          <button className="approval-btn deny" onClick={handleDeny}>
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
