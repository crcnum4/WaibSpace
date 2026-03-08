export type RiskClass = "A" | "B" | "C";
export type PolicyVerdict = "approved" | "denied" | "approval_required";

export interface PolicyDecision {
  action: string;
  riskClass: RiskClass;
  verdict: PolicyVerdict;
  reason: string;
  requiredApproval?: { prompt: string; context: unknown };
}
