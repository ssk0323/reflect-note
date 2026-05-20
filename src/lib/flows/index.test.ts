import { describe, it, expect } from "vitest";
import { getFlow } from ".";

describe("getFlow", () => {
  it("returns the morning flow for 'morning'", () => {
    const flow = getFlow("morning");
    expect(flow?.type).toBe("morning");
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
