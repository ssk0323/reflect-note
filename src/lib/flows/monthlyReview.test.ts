import { describe, it, expect } from "vitest";
import { monthlyReviewFlow } from "./monthlyReview";

describe("monthlyReviewFlow", () => {
  it("has the monthlyReview type and label", () => {
    expect(monthlyReviewFlow.type).toBe("monthlyReview");
    expect(monthlyReviewFlow.label).toBe("月の振り返り");
  });

  it("has 4 questions in the expected order", () => {
    expect(monthlyReviewFlow.questions.map((q) => q.key)).toEqual([
      "monthDone",
      "monthGood",
      "monthLearned",
      "nextMonthTry",
    ]);
  });
});
