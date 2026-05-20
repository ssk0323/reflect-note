import { describe, it, expect } from "vitest";
import { weeklyGoalFlow } from "./weeklyGoal";

describe("weeklyGoalFlow", () => {
  it("has the weeklyGoal type and label", () => {
    expect(weeklyGoalFlow.type).toBe("weeklyGoal");
    expect(weeklyGoalFlow.label).toBe("週の目標設定");
  });

  it("has 5 questions in the expected order", () => {
    expect(weeklyGoalFlow.questions.map((q) => q.key)).toEqual([
      "weekGoal",
      "weekFocus",
      "weekPriority1",
      "weekPriority2",
      "weekPriority3",
    ]);
  });
});
