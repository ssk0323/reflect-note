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
  it("groups records into date sections, preserving order within each", () => {
    const a = row("a", "2026-05-20T08:00:00Z"); // 2026-05-20 (UTC)
    const b = row("b", "2026-05-20T22:00:00Z");
    const c = row("c", "2026-05-19T10:00:00Z");

    const groups = groupRecordsByDate([b, a, c]);

    expect(groups).toHaveLength(2);
    expect(groups[0].dateKey).toBe("2026-05-20");
    expect(groups[0].records.map((r) => r.id)).toEqual(["b", "a"]);
    expect(groups[1].dateKey).toBe("2026-05-19");
    expect(groups[1].records.map((r) => r.id)).toEqual(["c"]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupRecordsByDate([])).toEqual([]);
  });
});

describe("formatDate", () => {
  it("formats ISO datetime into Japanese long date with weekday", () => {
    // 2026-05-20 は水曜
    expect(formatDate("2026-05-20T10:00:00Z")).toMatch(/2026年5月20日.*水/);
  });
});
