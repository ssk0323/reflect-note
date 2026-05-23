import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeAchievements, MONTHLY_COUNT_THRESHOLD } from "./achievements";
import type { RecordRow } from "./types";
import type { FlowType } from "@/lib/flows";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function r(id: string, type: FlowType, createdAt: string): RecordRow {
  return {
    id,
    type,
    answers: {},
    checks: {},
    target_date: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("computeAchievements", () => {
  it("returns empty when there are no records", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    expect(computeAchievements([])).toEqual([]);
  });

  it("grants weekly_complete when weeklyGoal AND weeklyReview in current week", () => {
    // 2026-05-20 (水) JST。週 = 月曜 5/18 〜 日曜 5/24
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      r("a", "weeklyGoal", "2026-05-18T03:00:00Z"),
      r("b", "weeklyReview", "2026-05-24T03:00:00Z"),
    ];
    const achievements = computeAchievements(records);
    expect(achievements.map((a) => a.code)).toContain("weekly_complete");
  });

  it("does NOT grant weekly_complete when only one of the two exists", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [r("a", "weeklyGoal", "2026-05-18T03:00:00Z")];
    expect(computeAchievements(records).map((a) => a.code)).not.toContain(
      "weekly_complete",
    );
  });

  it("ignores records outside the current week", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      r("a", "weeklyGoal", "2026-05-11T03:00:00Z"), // 先週
      r("b", "weeklyReview", "2026-05-24T03:00:00Z"), // 今週
    ];
    expect(computeAchievements(records).map((a) => a.code)).not.toContain(
      "weekly_complete",
    );
  });

  it("grants monthly_complete when monthlyGoal AND monthlyReview in current month", () => {
    // 2026-05-20 JST。月 = 5/1 〜 5/31
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      r("a", "monthlyGoal", "2026-05-01T03:00:00Z"),
      r("b", "monthlyReview", "2026-05-31T03:00:00Z"),
    ];
    expect(computeAchievements(records).map((a) => a.code)).toContain(
      "monthly_complete",
    );
  });

  it("grants monthly_count when total records in current month >= threshold", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records: RecordRow[] = [];
    for (let i = 0; i < MONTHLY_COUNT_THRESHOLD; i++) {
      records.push(
        r(
          `m${i}`,
          "morning",
          `2026-05-${String((i % 28) + 1).padStart(2, "0")}T03:00:00Z`,
        ),
      );
    }
    const codes = computeAchievements(records).map((a) => a.code);
    expect(codes).toContain("monthly_count");
  });

  it("does NOT grant monthly_count when below the threshold", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records: RecordRow[] = [];
    for (let i = 0; i < MONTHLY_COUNT_THRESHOLD - 1; i++) {
      records.push(
        r(
          `m${i}`,
          "morning",
          `2026-05-${String((i % 28) + 1).padStart(2, "0")}T03:00:00Z`,
        ),
      );
    }
    expect(computeAchievements(records).map((a) => a.code)).not.toContain(
      "monthly_count",
    );
  });

  // regression: Supabase が +00:00 表記やマイクロ秒精度で返しても
  // withinBounds が誤判定しないこと
  it("handles +00:00 timestamp format (Supabase variant)", () => {
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const records = [
      // 月曜 00:00 JST = 日曜 15:00 UTC の境界、+00:00 形式
      r("a", "weeklyGoal", "2026-05-17T15:00:00.123456+00:00"),
      r("b", "weeklyReview", "2026-05-24T08:30:00+00:00"),
    ];
    expect(computeAchievements(records).map((a) => a.code)).toContain(
      "weekly_complete",
    );
  });
});
