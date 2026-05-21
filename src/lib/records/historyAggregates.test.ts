import { describe, it, expect } from "vitest";
import {
  countByDate,
  countByType,
  longestConsecutiveDays,
  typesByDate,
} from "./historyAggregates";
import type { RecordRow } from "./types";
import type { FlowType } from "@/lib/flows";

function r(id: string, type: FlowType, createdAt: string): RecordRow {
  return {
    id,
    type,
    answers: {},
    checks: {},
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("historyAggregates / countByDate", () => {
  it("集計が空のときは空 Map を返す", () => {
    expect(countByDate([])).toEqual(new Map());
  });

  it("同じ JST 日付の record を合算する", () => {
    const records = [
      r("a", "morning", "2026-05-21T03:00:00Z"),
      r("b", "night", "2026-05-21T13:00:00Z"),
      r("c", "morning", "2026-05-20T03:00:00Z"),
    ];
    const map = countByDate(records);
    expect(map.get("2026-05-21")).toBe(2);
    expect(map.get("2026-05-20")).toBe(1);
  });
});

describe("historyAggregates / typesByDate", () => {
  it("同じ日に複数 type があれば Set にまとまる", () => {
    const records = [
      r("a", "morning", "2026-05-21T03:00:00Z"),
      r("b", "night", "2026-05-21T13:00:00Z"),
      r("c", "morning", "2026-05-21T03:30:00Z"), // 同種類の重複
    ];
    const map = typesByDate(records);
    const types = map.get("2026-05-21")!;
    expect(types.has("morning")).toBe(true);
    expect(types.has("night")).toBe(true);
    expect(types.size).toBe(2);
  });
});

describe("historyAggregates / countByType", () => {
  it("type ごとの件数と全体件数を返す", () => {
    const records = [
      r("a", "morning", "2026-05-21T03:00:00Z"),
      r("b", "morning", "2026-05-20T03:00:00Z"),
      r("c", "night", "2026-05-20T13:00:00Z"),
      r("d", "weeklyGoal", "2026-05-18T03:00:00Z"),
    ];
    expect(countByType(records)).toEqual({
      all: 4,
      morning: 2,
      night: 1,
      weeklyGoal: 1,
      weeklyReview: 0,
      monthlyGoal: 0,
      monthlyReview: 0,
    });
  });
});

describe("historyAggregates / longestConsecutiveDays", () => {
  it("空なら 0", () => {
    expect(longestConsecutiveDays([])).toBe(0);
  });

  it("単日なら 1", () => {
    expect(longestConsecutiveDays(["2026-05-21"])).toBe(1);
  });

  it("3 日連続なら 3", () => {
    expect(
      longestConsecutiveDays(["2026-05-20", "2026-05-21", "2026-05-22"]),
    ).toBe(3);
  });

  it("途切れたら短い方", () => {
    expect(
      longestConsecutiveDays([
        "2026-05-18",
        "2026-05-20",
        "2026-05-21",
        "2026-05-22",
      ]),
    ).toBe(3);
  });

  it("複数の連続区間から最長を返す", () => {
    expect(
      longestConsecutiveDays([
        "2026-05-01",
        "2026-05-02",
        "2026-05-05",
        "2026-05-06",
        "2026-05-07",
        "2026-05-08",
      ]),
    ).toBe(4);
  });

  it("重複した日付は 1 つとして扱う", () => {
    expect(
      longestConsecutiveDays(["2026-05-20", "2026-05-20", "2026-05-21"]),
    ).toBe(2);
  });
});
