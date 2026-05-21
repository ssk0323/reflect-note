import type { RecordRow } from "./types";
import type { FlowType } from "@/lib/flows";

/** 履歴ページのヒートマップ・フィルタバッジ用の集計ヘルパー。
 *  date の決め方は groupRecordsByDate と同じ (JST の暦日)。 */

const TIME_ZONE = "Asia/Tokyo";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toJstDateKey(isoDateTime: string): string {
  return dateKeyFormatter.format(new Date(isoDateTime));
}

/** records を JST 日付ごとの件数 Map に集計。ヒートマップに使う。 */
export function countByDate(records: RecordRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = toJstDateKey(r.created_at);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/** records を JST 日付ごとに「どの type が存在したか」のセット Map に集計。
 *  月カレンダーの色付きドット表示に使う。 */
export function typesByDate(records: RecordRow[]): Map<string, Set<FlowType>> {
  const map = new Map<string, Set<FlowType>>();
  for (const r of records) {
    const key = toJstDateKey(r.created_at);
    const set = map.get(key);
    if (set) {
      set.add(r.type);
    } else {
      map.set(key, new Set([r.type]));
    }
  }
  return map;
}

/** 種別ごとの件数 + 全体件数。フィルタチップのバッジに使う。 */
export type TypeCounts = {
  all: number;
  morning: number;
  night: number;
  weeklyGoal: number;
  weeklyReview: number;
  monthlyGoal: number;
  monthlyReview: number;
};

export function countByType(records: RecordRow[]): TypeCounts {
  const counts: TypeCounts = {
    all: records.length,
    morning: 0,
    night: 0,
    weeklyGoal: 0,
    weeklyReview: 0,
    monthlyGoal: 0,
    monthlyReview: 0,
  };
  for (const r of records) {
    counts[r.type] += 1;
  }
  return counts;
}

/** 与えられた日付集合のうち、連続している最長日数を返す。
 *  ストリーク表示やヒートマップ下部の最長記録に使う。 */
export function longestConsecutiveDays(dateKeys: Iterable<string>): number {
  const set = new Set(dateKeys);
  if (set.size === 0) return 0;
  let longest = 0;
  for (const key of set) {
    // 前日が存在しない = 連続区間の始点
    const prev = shiftDateKey(key, -1);
    if (set.has(prev)) continue;
    let run = 1;
    let cursor = shiftDateKey(key, 1);
    while (set.has(cursor)) {
      run += 1;
      cursor = shiftDateKey(cursor, 1);
    }
    if (run > longest) longest = run;
  }
  return longest;
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays);
  return new Date(utc).toISOString().slice(0, 10);
}
