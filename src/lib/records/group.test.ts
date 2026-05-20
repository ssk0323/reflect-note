import { describe, it, expect } from "vitest";
import { groupRecordsByDate, formatDate } from "./group";
import type { RecordRow } from "./types";

function row(id: string, createdAt: string, type: RecordRow["type"] = "morning"): RecordRow {
  return {
    id,
    type,
    answers: {},
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("groupRecordsByDate", () => {
  it("groups records by JST date and orders groups by dateKey desc", () => {
    // すべて JST 9時～22時の範囲に収めて UTC ↔ JST 越境を避ける
    const a = row("a", "2026-05-20T03:00:00Z"); // JST 12:00 → 5/20
    const b = row("b", "2026-05-20T08:00:00Z"); // JST 17:00 → 5/20
    const c = row("c", "2026-05-19T05:00:00Z"); // JST 14:00 → 5/19

    // 入力順は意図的にバラけさせる (Map 挿入順依存テストの兼用)
    const groups = groupRecordsByDate([c, b, a]);

    expect(groups).toHaveLength(2);
    expect(groups[0].dateKey).toBe("2026-05-20"); // 新しい日付が先
    expect(groups[0].records.map((r) => r.id)).toEqual(["b", "a"]);
    expect(groups[1].dateKey).toBe("2026-05-19");
    expect(groups[1].records.map((r) => r.id)).toEqual(["c"]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupRecordsByDate([])).toEqual([]);
  });
});

describe("formatDate", () => {
  it("formats ISO datetime into Japanese long date with weekday in JST", () => {
    // 2026-05-20 10:00 UTC = 2026-05-20 19:00 JST → 水曜
    expect(formatDate("2026-05-20T10:00:00Z")).toMatch(/2026年5月20日.*水/);
  });
});

describe("timezone boundary handling", () => {
  it("groups by JST date around UTC midnight boundary", () => {
    // 2026-05-19 15:30 UTC = 2026-05-20 00:30 JST → JST では 5/20
    // 2026-05-19 14:30 UTC = 2026-05-19 23:30 JST → JST では 5/19
    const a = row("a", "2026-05-19T15:30:00Z"); // JST: 5/20 00:30
    const b = row("b", "2026-05-19T14:30:00Z"); // JST: 5/19 23:30

    const groups = groupRecordsByDate([a, b]);

    // 2 つの異なる日付グループになる
    expect(groups).toHaveLength(2);
    // JST 5/20 が先に来る (desc sort のはず)
    expect(groups[0].dateKey).toBe("2026-05-20");
    expect(groups[1].dateKey).toBe("2026-05-19");
  });

  it("formatDate output matches the dateKey timezone (JST)", () => {
    // UTC 15:00 = JST 24:00 = JST 翌日 00:00
    const iso = "2026-05-19T15:00:00Z";
    // formatDate も JST で 5/20 表示
    expect(formatDate(iso)).toMatch(/2026年5月20日/);
    // groupRecordsByDate の dateKey も 2026-05-20
    const groups = groupRecordsByDate([row("x", iso)]);
    expect(groups[0].dateKey).toBe("2026-05-20");
  });
});
