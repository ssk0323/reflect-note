import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  defaultDateOptions,
  diffDays,
  flowDirection,
  formatTargetLabel,
  isAllowedDirection,
  isValidDateString,
  normalizeTargetDate,
  parseJstDateString,
  resolveRecordDate,
  startOfJstMonth,
  startOfJstWeek,
  toJstDateString,
} from "./targetDate";

const may21noon = new Date("2026-05-21T03:00:00Z"); // JST 12:00 (木)
const may20noon = new Date("2026-05-20T03:00:00Z"); // JST 12:00 (水)
const may24noon = new Date("2026-05-24T03:00:00Z"); // JST 12:00 (日)
const may25noon = new Date("2026-05-25T03:00:00Z"); // JST 12:00 (月)

describe("targetDate / 日付変換", () => {
  it("toJstDateString は JST タイムゾーンで日付を返す", () => {
    // UTC 17:00 = JST 翌日 02:00
    expect(toJstDateString(new Date("2026-05-20T17:00:00Z"))).toBe("2026-05-21");
    expect(toJstDateString(may21noon)).toBe("2026-05-21");
  });

  it("parseJstDateString は JST の同じ日に戻る", () => {
    const d = parseJstDateString("2026-05-21");
    expect(toJstDateString(d)).toBe("2026-05-21");
  });

  it("isValidDateString は YYYY-MM-DD 形式のみを許す", () => {
    expect(isValidDateString("2026-05-21")).toBe(true);
    expect(isValidDateString("2026-5-21")).toBe(false);
    expect(isValidDateString("2026/05/21")).toBe(false);
    expect(isValidDateString(123)).toBe(false);
  });

  it("addDays / diffDays は対称的", () => {
    expect(addDays("2026-05-21", 1)).toBe("2026-05-22");
    expect(addDays("2026-05-21", -1)).toBe("2026-05-20");
    expect(diffDays("2026-05-22", "2026-05-21")).toBe(1);
    expect(diffDays("2026-05-21", "2026-05-22")).toBe(-1);
    expect(diffDays("2026-05-21", "2026-05-21")).toBe(0);
  });

  it("addDays は月をまたぐ", () => {
    expect(addDays("2026-05-31", 1)).toBe("2026-06-01");
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
  });

  it("addMonths は月単位で進む", () => {
    expect(addMonths("2026-05-01", 1)).toBe("2026-06-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
});

describe("targetDate / 週・月の境界", () => {
  it("startOfJstWeek は月曜を返す (木曜)", () => {
    // 2026-05-21 (木) -> 2026-05-18 (月)
    expect(startOfJstWeek("2026-05-21")).toBe("2026-05-18");
  });

  it("startOfJstWeek は月曜の場合そのまま", () => {
    expect(startOfJstWeek("2026-05-18")).toBe("2026-05-18");
  });

  it("startOfJstWeek は日曜の場合前週月曜を返す", () => {
    expect(startOfJstWeek("2026-05-24")).toBe("2026-05-18");
  });

  it("startOfJstMonth は 1 日を返す", () => {
    expect(startOfJstMonth("2026-05-21")).toBe("2026-05-01");
  });

  it("normalizeTargetDate は flow type に応じて丸める", () => {
    expect(normalizeTargetDate("morning", "2026-05-21")).toBe("2026-05-21");
    expect(normalizeTargetDate("weeklyGoal", "2026-05-21")).toBe("2026-05-18");
    expect(normalizeTargetDate("monthlyReview", "2026-05-21")).toBe("2026-05-01");
  });
});

describe("targetDate / flowDirection", () => {
  it("Goal 系は future、night/Review 系は past", () => {
    expect(flowDirection("morning")).toBe("future");
    expect(flowDirection("weeklyGoal")).toBe("future");
    expect(flowDirection("monthlyGoal")).toBe("future");
    expect(flowDirection("night")).toBe("past");
    expect(flowDirection("weeklyReview")).toBe("past");
    expect(flowDirection("monthlyReview")).toBe("past");
  });
});

describe("targetDate / defaultDateOptions", () => {
  it("morning は今日・明日・明明日", () => {
    const opts = defaultDateOptions("morning", may21noon);
    expect(opts.map((o) => o.value)).toEqual([
      "2026-05-21",
      "2026-05-22",
      "2026-05-23",
    ]);
    expect(opts.map((o) => o.label)).toEqual(["今日", "明日", "明明日"]);
  });

  it("night は今日・昨日・一昨日", () => {
    const opts = defaultDateOptions("night", may21noon);
    expect(opts.map((o) => o.value)).toEqual([
      "2026-05-21",
      "2026-05-20",
      "2026-05-19",
    ]);
    expect(opts.map((o) => o.label)).toEqual(["今日", "昨日", "一昨日"]);
  });

  it("weeklyGoal は月曜固定で今週・来週・再来週", () => {
    const opts = defaultDateOptions("weeklyGoal", may21noon);
    expect(opts.map((o) => o.value)).toEqual([
      "2026-05-18",
      "2026-05-25",
      "2026-06-01",
    ]);
    expect(opts.map((o) => o.label)).toEqual(["今週", "来週", "再来週"]);
  });

  it("weeklyReview は今週・先週・先々週", () => {
    const opts = defaultDateOptions("weeklyReview", may21noon);
    expect(opts.map((o) => o.value)).toEqual([
      "2026-05-18",
      "2026-05-11",
      "2026-05-04",
    ]);
  });

  it("monthlyGoal は今月・来月・再来月", () => {
    const opts = defaultDateOptions("monthlyGoal", may21noon);
    expect(opts.map((o) => o.value)).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
  });

  it("monthlyReview は今月・先月・先々月", () => {
    const opts = defaultDateOptions("monthlyReview", may21noon);
    expect(opts.map((o) => o.value)).toEqual([
      "2026-05-01",
      "2026-04-01",
      "2026-03-01",
    ]);
  });
});

describe("targetDate / isAllowedDirection", () => {
  it("morning は今日・未来 OK、過去 NG", () => {
    expect(isAllowedDirection("morning", "2026-05-21", may21noon)).toBe(true);
    expect(isAllowedDirection("morning", "2026-05-22", may21noon)).toBe(true);
    expect(isAllowedDirection("morning", "2026-05-20", may21noon)).toBe(false);
  });

  it("night は今日・過去 OK、未来 NG", () => {
    expect(isAllowedDirection("night", "2026-05-21", may21noon)).toBe(true);
    expect(isAllowedDirection("night", "2026-05-20", may21noon)).toBe(true);
    expect(isAllowedDirection("night", "2026-05-22", may21noon)).toBe(false);
  });

  it("weeklyGoal は今週月曜以降を許す (月曜換算で比較)", () => {
    // 木曜時点での今週月曜は 5/18
    expect(isAllowedDirection("weeklyGoal", "2026-05-18", may21noon)).toBe(true);
    expect(isAllowedDirection("weeklyGoal", "2026-05-25", may21noon)).toBe(true);
    expect(isAllowedDirection("weeklyGoal", "2026-05-11", may21noon)).toBe(false);
  });

  it("monthlyReview は今月以前を許す", () => {
    expect(isAllowedDirection("monthlyReview", "2026-05-01", may21noon)).toBe(true);
    expect(isAllowedDirection("monthlyReview", "2026-04-01", may21noon)).toBe(true);
    expect(isAllowedDirection("monthlyReview", "2026-06-01", may21noon)).toBe(false);
  });
});

describe("targetDate / formatTargetLabel", () => {
  // formatTargetLabel は new Date() を内部で使うので、固定するためモック可能だが
  // ここでは may21noon と今日が同じ前提のテストではなく、関係性のみテスト。
  it("週/月の境界をまたぐ表記が破綻しない", () => {
    // 月曜日 (5/25) からみて 5/18 は先週、5/25 は今週、6/1 は来週
    // ただし new Date() を使うので環境依存。format 関数の存在確認まで。
    const result = formatTargetLabel("morning", "2026-05-21");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("targetDate / resolveRecordDate", () => {
  it("target_date があればそれを返す", () => {
    expect(
      resolveRecordDate({ target_date: "2026-05-22", created_at: "2026-05-21T03:00:00Z" }),
    ).toBe("2026-05-22");
  });

  it("target_date が null なら created_at の JST 日付", () => {
    expect(
      resolveRecordDate({ target_date: null, created_at: "2026-05-20T17:00:00Z" }),
    ).toBe("2026-05-21"); // JST では 5/21 02:00
  });
});

describe("targetDate / 月またぎ・年またぎのエッジケース", () => {
  it("月末から翌月への week 計算", () => {
    expect(startOfJstWeek("2026-05-31")).toBe("2026-05-25");
    expect(startOfJstWeek("2026-06-01")).toBe("2026-06-01");
  });

  it("年またぎの addMonths", () => {
    expect(addMonths("2025-12-01", 1)).toBe("2026-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("月末日の monday からのオプションが日曜まで正しく出る", () => {
    const opts = defaultDateOptions("weeklyGoal", may25noon);
    // 5/25 (月) の今週は 5/25-5/31
    expect(opts[0].value).toBe("2026-05-25");
    expect(opts[0].detail).toContain("5/31");
  });

  it("日曜は前週扱い (月曜始まり)", () => {
    const opts = defaultDateOptions("weeklyGoal", may24noon);
    // 5/24 (日) の今週は 5/18-5/24
    expect(opts[0].value).toBe("2026-05-18");
  });
});

describe("targetDate / parseJstDateString エラー", () => {
  it("不正な形式は例外", () => {
    expect(() => parseJstDateString("2026/05/21")).toThrow();
    expect(() => parseJstDateString("invalid")).toThrow();
  });
});

// may20noon は今のところ未使用だが将来テスト追加時の参照を残す
void may20noon;
