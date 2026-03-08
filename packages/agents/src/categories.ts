export const AGENT_CATEGORIES = {
  perception: "Normalize input signals into structured events",
  reasoning: "Interpret what the user is trying to do",
  context: "Determine what data is needed and retrieve it",
  ui: "Propose surface specifications",
  safety: "Evaluate policy and trust",
  execution: "Carry out approved actions",
} as const;
