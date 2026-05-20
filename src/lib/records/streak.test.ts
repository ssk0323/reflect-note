import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeStreak } from "./streak";
import type { RecordRow } from "./types";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function morning(createdAt: string): RecordRow {
  return {
    id: createdAt,
    type: "morning",
    answers: {},
    checks: {},
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("computeStreak", () => {
  it("returns 0 / 0 when there are no records", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    expect(computeStreak([], "morning")).toEqual({
      current: 0,
      longest: 0,
      lastDate: null,
    });
  });

  it("counts consecutive days ending today (JST)", () => {
    // 今: 2026-05-20 12:00 JST
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      morning("2026-05-20T03:00:00Z"), // JST 5/20
      morning("2026-05-19T03:00:00Z"), // JST 5/19
      morning("2026-05-18T03:00:00Z"), // JST 5/18
    ];
    const result = computeStreak(records, "morning");
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
    expect(result.lastDate).toBe("2026-05-20");
  });

  it("counts consecutive days ending yesterday (today not yet recorded)", () => {
    // 今: 2026-05-20 12:00 JST。今日はまだ未入力
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      morning("2026-05-19T03:00:00Z"),
      morning("2026-05-18T03:00:00Z"),
    ];
    const result = computeStreak(records, "morning");
    expect(result.current).toBe(2);
    expect(result.longest).toBe(2);
    expect(result.lastDate).toBe("2026-05-19");
  });

  it("resets current to 0 when yesterday is also missing", () => {
    // 今: 2026-05-20 12:00 JST。昨日も今日もなし
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      morning("2026-05-18T03:00:00Z"), // 一昨日
      morning("2026-05-17T03:00:00Z"),
    ];
    const result = computeStreak(records, "morning");
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
    expect(result.lastDate).toBe("2026-05-18");
  });

  it("computes the longest streak from past data even if current is shorter", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      morning("2026-05-20T03:00:00Z"), // 5/20
      // 5/19 はギャップ
      morning("2026-05-15T03:00:00Z"),
      morning("2026-05-14T03:00:00Z"),
      morning("2026-05-13T03:00:00Z"),
      morning("2026-05-12T03:00:00Z"),
    ];
    const result = computeStreak(records, "morning");
    expect(result.current).toBe(1);
    expect(result.longest).toBe(4);
  });

  it("filters by the requested type", () => {
    // 今: 2026-05-20 12:00 JST
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records: RecordRow[] = [
      morning("2026-05-20T03:00:00Z"), // morning 今日
      {
        id: "night",
        type: "night",
        answers: {},
        checks: {},
        created_at: "2026-05-19T13:00:00Z", // night JST 5/19 22:00
        updated_at: "2026-05-19T13:00:00Z",
      },
    ];
    // morning は今日のみ → current 1, longest 1
    expect(computeStreak(records, "morning")).toEqual({
      current: 1,
      longest: 1,
      lastDate: "2026-05-20",
    });
    // night は昨日のみ、今日未入力 → current 1 (昨日まで連続), longest 1
    expect(computeStreak(records, "night")).toEqual({
      current: 1,
      longest: 1,
      lastDate: "2026-05-19",
    });
  });

  it("deduplicates multiple records on the same JST day", () => {
    // 同じ日に morning を 2 回入力しても 1 日扱い
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      morning("2026-05-20T03:00:00Z"), // JST 5/20 12:00
      morning("2026-05-20T11:00:00Z"), // JST 5/20 20:00
      morning("2026-05-19T03:00:00Z"),
    ];
    const result = computeStreak(records, "morning");
    expect(result.current).toBe(2);
    expect(result.longest).toBe(2);
  });
});
