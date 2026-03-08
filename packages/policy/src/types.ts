import type { RiskClass } from "@waibspace/types";

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  actionPattern: string;
  riskClass: RiskClass;
  autoApprove: boolean;
  conditions?: PolicyCondition[];
}

export interface PolicyCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "in";
  value: unknown;
}

export interface ProposedAction {
  actionType: string;
  connector?: string;
  trustLevel?: string;
  payload?: unknown;
  agentId: string;
  traceId: string;
}
