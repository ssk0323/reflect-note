import { describe, it, expect } from "vitest";
import { monthlyGoalFlow } from "./monthlyGoal";

describe("monthlyGoalFlow", () => {
  it("has the monthlyGoal type and label", () => {
    expect(monthlyGoalFlow.type).toBe("monthlyGoal");
    expect(monthlyGoalFlow.label).toBe("月の目標設定");
  });

  it("has 5 questions in the expected order", () => {
    expect(monthlyGoalFlow.questions.map((q) => q.key)).toEqual([
      "monthGoal",
      "monthTheme",
      "monthPriority1",
      "monthPriority2",
      "monthPriority3",
    ]);
  });
});
