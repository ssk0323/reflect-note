import { describe, it, expect } from "vitest";
import {
  applyBucketChangeOptimistic,
  applyDeleteOptimistic,
  applyMoveOptimistic,
  computeMoveTarget,
} from "./computeMoveTarget";
import type { TodoBucket, TodoRow } from "@/lib/todos/types";

function row(id: string, bucket: TodoBucket, position: number): TodoRow {
  return {
    id,
    target_date: "2026-05-22",
    text: id,
    bucket,
    time: null,
    position,
    done: false,
    important: false,
    carry_from_date: null,
    carry_from_todo_id: null,
    created_at: "2026-05-22T00:00:00Z",
    updated_at: "2026-05-22T00:00:00Z",
  };
}

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

describe("applyMoveOptimistic (Issue #44)", () => {
  it("同 bucket: A を末尾に動かすと position が再採番される", () => {
    const todos = [
      row("a", "morning", 0),
      row("b", "morning", 1),
      row("c", "morning", 2),
    ];
    const result = applyMoveOptimistic(todos, "a", "morning", 2);
    // 期待: B(0), C(1), A(2)
    expect(result.map((t) => [t.id, t.bucket, t.position])).toEqual([
      ["b", "morning", 0],
      ["c", "morning", 1],
      ["a", "morning", 2],
    ]);
  });

  it("bucket 跨ぎ: M1 を afternoon position 1 に動かす", () => {
    const todos = [
      row("m1", "morning", 0),
      row("m2", "morning", 1),
      row("a1", "afternoon", 0),
      row("a2", "afternoon", 1),
    ];
    const result = applyMoveOptimistic(todos, "m1", "afternoon", 1);
    // 期待:
    //   morning: M2(0)
    //   afternoon: A1(0), M1(1), A2(2)
    expect(result.map((t) => [t.id, t.bucket, t.position])).toEqual([
      ["m2", "morning", 0],
      ["a1", "afternoon", 0],
      ["m1", "afternoon", 1],
      ["a2", "afternoon", 2],
    ]);
  });

  it("存在しない id なら todos をそのまま返す", () => {
    const todos = [row("a", "morning", 0)];
    expect(applyMoveOptimistic(todos, "x", "afternoon", 0)).toBe(todos);
  });

  it("空 bucket へ移動", () => {
    const todos = [row("a", "morning", 0), row("b", "morning", 1)];
    const result = applyMoveOptimistic(todos, "a", "night", 0);
    // morning: B(0), night: A(0)
    expect(result.map((t) => [t.id, t.bucket, t.position])).toEqual([
      ["b", "morning", 0],
      ["a", "night", 0],
    ]);
  });
});

describe("applyDeleteOptimistic (PR #45 review)", () => {
  it("指定 id を除外する", () => {
    const todos = [
      row("a", "morning", 0),
      row("b", "morning", 1),
      row("c", "afternoon", 0),
    ];
    const result = applyDeleteOptimistic(todos, "b");
    expect(result.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("存在しない id ならそのまま", () => {
    const todos = [row("a", "morning", 0)];
    const result = applyDeleteOptimistic(todos, "x");
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("applyBucketChangeOptimistic (PR #45 review)", () => {
  it("新 bucket の末尾に移動する", () => {
    const todos = [
      row("a", "morning", 0),
      row("b", "morning", 1),
      row("c", "afternoon", 0),
    ];
    const result = applyBucketChangeOptimistic(todos, "a", "afternoon");
    // morning: B(0), afternoon: C(0), A(1)
    expect(result.map((t) => [t.id, t.bucket, t.position])).toEqual([
      ["b", "morning", 0],
      ["c", "afternoon", 0],
      ["a", "afternoon", 1],
    ]);
  });

  it("同じ bucket への変更は no-op", () => {
    const todos = [row("a", "morning", 0)];
    const result = applyBucketChangeOptimistic(todos, "a", "morning");
    expect(result).toBe(todos);
  });

  it("存在しない id ならそのまま", () => {
    const todos = [row("a", "morning", 0)];
    expect(applyBucketChangeOptimistic(todos, "x", "afternoon")).toBe(todos);
  });
});
