import { describe, it, expect } from "vitest";
import { morningFlow } from "./morning";

describe("morningFlow", () => {
  it("has the morning type", () => {
    expect(morningFlow.type).toBe("morning");
  });

  it("has the expected label", () => {
    expect(morningFlow.label).toBe("朝のセットアップ");
  });

  it("has 5 questions with the expected keys", () => {
    expect(morningFlow.questions.map((q) => q.key)).toEqual([
      "goal",
      "task1",
      "task2",
      "task3",
      "attention",
    ]);
  });

  it("marks goal and attention as multiline, tasks as single-line", () => {
    const byKey = Object.fromEntries(morningFlow.questions.map((q) => [q.key, q]));
    expect(byKey.goal.kind).toBe("textarea");
    expect(byKey.attention.kind).toBe("textarea");
    expect(byKey.task1.kind).toBe("input");
    expect(byKey.task2.kind).toBe("input");
    expect(byKey.task3.kind).toBe("input");
  });
});
