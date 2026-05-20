import type { Flow, FlowType } from "./types";
import { morningFlow } from "./morning";

const FLOWS = {
  morning: morningFlow,
} satisfies Partial<Record<FlowType, Flow>>;

export type DefinedFlowType = keyof typeof FLOWS;

export function getFlow(type: string): Flow | null {
  if (type in FLOWS) {
    return FLOWS[type as DefinedFlowType];
  }
  return null;
}

export const definedFlows = FLOWS;
export { morningFlow } from "./morning";
export { FLOW_TYPES } from "./types";
export type { Flow, FlowType, Question, FlowAnswers } from "./types";
