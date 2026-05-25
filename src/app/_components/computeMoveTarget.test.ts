import { describe, it, expect } from "vitest";
import { computeMoveTarget } from "./computeMoveTarget";
import type { TodoBucket } from "@/lib/todos/types";

// flat list helper
function items(...rows: [string, TodoBucket][]) {
  return rows.map(([id, bucket]) => ({ id, bucket }));
}

describe("computeMoveTarget (Issue #44)", () => {
  it("active === over なら null を返す", () => {
    const flat = items(["a", "morning"], ["b", "morning"]);
    expect(computeMoveTarget(flat, "a", "a")).toBeNull();
  });

  it("存在しない id なら null", () => {
    const flat = items(["a", "morning"], ["b", "morning"]);
    expect(computeMoveTarget(flat, "x", "a")).toBeNull();
    expect(computeMoveTarget(flat, "a", "x")).toBeNull();
  });

  it("同 bucket: 下方向への移動 (位置 0 → 2 を 0 → 1 へ動かす相当)", () => {
    // morning: [A, B, C] → A を C の位置にドロップ → A が最後尾
    const flat = items(["a", "morning"], ["b", "morning"], ["c", "morning"]);
    const result = computeMoveTarget(flat, "a", "c");
    expect(result).toEqual({ bucket: "morning", position: 2 });
  });

  it("同 bucket: 上方向への移動", () => {
    // morning: [A, B, C] → C を A の位置にドロップ → C が先頭
    const flat = items(["a", "morning"], ["b", "morning"], ["c", "morning"]);
    const result = computeMoveTarget(flat, "c", "a");
    expect(result).toEqual({ bucket: "morning", position: 0 });
  });

  it("bucket 跨ぎ: morning → afternoon (中間)", () => {
    // morning: [M1, M2], afternoon: [A1, A2]
    // M1 を A1 にドロップ
    const flat = items(
      ["m1", "morning"],
      ["m2", "morning"],
      ["a1", "afternoon"],
      ["a2", "afternoon"],
    );
    const result = computeMoveTarget(flat, "m1", "a1");
    // arrayMove([M1,M2,A1,A2], 0, 2) = [M2, A1, M1, A2]
    // M1 at idx 2, 上は A1 (afternoon) → newBucket = afternoon
    // afternoon items before M1 in newOrder: A1 (1個) → position = 1
    expect(result).toEqual({ bucket: "afternoon", position: 1 });
  });

  it("bucket 跨ぎ: afternoon → morning (先頭にドロップ)", () => {
    // morning: [M1, M2], afternoon: [A1, A2]
    // A2 を M1 にドロップ
    const flat = items(
      ["m1", "morning"],
      ["m2", "morning"],
      ["a1", "afternoon"],
      ["a2", "afternoon"],
    );
    const result = computeMoveTarget(flat, "a2", "m1");
    // arrayMove([M1,M2,A1,A2], 3, 0) = [A2, M1, M2, A1]
    // A2 at idx 0, 上は無いので下を見る (M1, morning) → newBucket = morning
    // newPosition = 0 (前に morning が無い)
    expect(result).toEqual({ bucket: "morning", position: 0 });
  });

  it("末尾へのドロップ", () => {
    const flat = items(
      ["m1", "morning"],
      ["m2", "morning"],
      ["a1", "afternoon"],
      ["a2", "afternoon"],
    );
    // M1 を A2 (末尾) にドロップ
    const result = computeMoveTarget(flat, "m1", "a2");
    // arrayMove([M1,M2,A1,A2], 0, 3) = [M2, A1, A2, M1]
    // M1 at idx 3, 上は A2 (afternoon) → newBucket = afternoon
    // afternoon items before M1: A1, A2 → position = 2
    expect(result).toEqual({ bucket: "afternoon", position: 2 });
  });

  it("空の bucket への drop (over がない場合) は null", () => {
    // 仕様上 over === null は呼び出し側で early return するが、
    // overId="" のように invalid なら null を返す
    const flat = items(["a", "morning"]);
    expect(computeMoveTarget(flat, "a", "")).toBeNull();
  });
});
