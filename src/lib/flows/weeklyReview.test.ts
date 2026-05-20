import { describe, it, expect } from "vitest";
import { weeklyReviewFlow } from "./weeklyReview";

describe("weeklyReviewFlow", () => {
  it("has the weeklyReview type and label", () => {
    expect(weeklyReviewFlow.type).toBe("weeklyReview");
    expect(weeklyReviewFlow.label).toBe("週の振り返り");
  });

  it("has 4 questions in the expected order", () => {
    expect(weeklyReviewFlow.questions.map((q) => q.key)).toEqual([
      "weekDone",
      "weekGood",
      "weekLearned",
      "nextWeekTry",
    ]);
  });
});
