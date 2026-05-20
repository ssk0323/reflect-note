import { describe, it, expect } from "vitest";
import { getFlow } from ".";

describe("getFlow", () => {
  it("returns the correct flow for each of the 6 defined types", () => {
    expect(getFlow("morning")?.type).toBe("morning");
    expect(getFlow("night")?.type).toBe("night");
    expect(getFlow("weeklyGoal")?.type).toBe("weeklyGoal");
    expect(getFlow("weeklyReview")?.type).toBe("weeklyReview");
    expect(getFlow("monthlyGoal")?.type).toBe("monthlyGoal");
    expect(getFlow("monthlyReview")?.type).toBe("monthlyReview");
  });

  it("returns null for an unknown flow type", () => {
    expect(getFlow("unknown")).toBeNull();
  });

  it("returns null for prototype-key inputs like 'toString' / 'constructor'", () => {
    // Object.create(null) ではなく通常の object をベースにしているので、
    // `in` 演算子だと prototype 経由で true を返してしまうリスクがある
    expect(getFlow("toString")).toBeNull();
    expect(getFlow("constructor")).toBeNull();
    expect(getFlow("__proto__")).toBeNull();
    expect(getFlow("hasOwnProperty")).toBeNull();
  });
});
