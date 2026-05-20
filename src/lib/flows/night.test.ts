import { describe, it, expect } from "vitest";
import { nightFlow } from "./night";

describe("nightFlow", () => {
  it("has the night type and label", () => {
    expect(nightFlow.type).toBe("night");
    expect(nightFlow.label).toBe("夜のリフレクション");
  });

  it("has 7 questions in the expected order", () => {
    expect(nightFlow.questions.map((q) => q.key)).toEqual([
      "done",
      "good",
      "stuck",
      "tomorrow",
      "tryTomorrow",
      "timeUsage",
      "messageToTomorrowSelf",
    ]);
  });

  it("has timeUsage as a group question with 4 fields", () => {
    const timeUsage = nightFlow.questions.find((q) => q.key === "timeUsage");
    expect(timeUsage?.kind).toBe("group");
    if (timeUsage?.kind !== "group") {
      throw new Error("expected group");
    }
    expect(timeUsage.fields.map((f) => f.key)).toEqual([
      "timeMorning",
      "timeForenoon",
      "timeAfternoon",
      "timeNight",
    ]);
  });
});
