import type { Flow, FlowType } from "./types";
import { morningFlow } from "./morning";
import { nightFlow } from "./night";
import { weeklyGoalFlow } from "./weeklyGoal";
import { weeklyReviewFlow } from "./weeklyReview";
import { monthlyGoalFlow } from "./monthlyGoal";
import { monthlyReviewFlow } from "./monthlyReview";

const FLOWS = {
  morning: morningFlow,
  night: nightFlow,
  weeklyGoal: weeklyGoalFlow,
  weeklyReview: weeklyReviewFlow,
  monthlyGoal: monthlyGoalFlow,
  monthlyReview: monthlyReviewFlow,
} satisfies Record<FlowType, Flow>;

export type DefinedFlowType = keyof typeof FLOWS;

export function getFlow(type: string): Flow | null {
  // prototype-key (toString, constructor, __proto__ など) で `in` 演算子が
  // true を返してしまう問題を避けるため、own property のみを許可する。
  if (Object.hasOwn(FLOWS, type)) {
    return FLOWS[type as DefinedFlowType];
  }
  return null;
}

export const definedFlows = FLOWS;
export { morningFlow } from "./morning";
export { nightFlow } from "./night";
export { weeklyGoalFlow } from "./weeklyGoal";
export { weeklyReviewFlow } from "./weeklyReview";
export { monthlyGoalFlow } from "./monthlyGoal";
export { monthlyReviewFlow } from "./monthlyReview";
export { FLOW_TYPES } from "./types";
export type { Flow, FlowType, Question, FlowAnswers } from "./types";
