import type { RecordRow } from "./types";
import type { FlowType } from "@/lib/flows";

// トップ画面でストリーク計算用に過去から取得する日数。
// 月境界 (例: 31 日締めでアクセス) でも今月分を確実にカバーできるよう、
// 月の最大日数 (31) より 4 日広めに取って 35 日にしている。
// 注意: longest は「この期間内の最大連続日数」を意味する。歴代の最長は
// 別途集計テーブル (将来の streaks テーブル) に永続化する想定。
export const STREAK_LOOKBACK_DAYS = 35;

export type Streak = {
  /** 今日 or 昨日まで連続して入力した日数。途切れていたら 0 */
  current: number;
  /** 渡された records 範囲内での最大連続日数 (= 直近 STREAK_LOOKBACK_DAYS 日)。
   *  「歴代の最大」を表したい場合は永続化テーブルが必要。 */
  longest: number;
  /** 最後に入力した JST 日付 (YYYY-MM-DD)。なしなら null */
  lastDate: string | null;
};

// Asia/Tokyo の暦日キーを得るためのフォーマッタ (group.ts と同じ方針)
const TZ = "Asia/Tokyo";
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toJstDateKey(isoOrDate: string | Date): string {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return dateKeyFormatter.format(date);
}

// YYYY-MM-DD 形式の日付文字列を 1 日前/後にずらす。
// Date オブジェクト経由で計算するので閏年や月末も正しく処理される。
function shiftDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays);
  return new Date(utc).toISOString().slice(0, 10);
}

/**
 * records から指定 type のストリーク (current / longest / lastDate) を計算する。
 *
 * - current: 今日 or 昨日まで連続して入力した日数。今日でも昨日でもなければ 0
 *   (= 既に途切れている)
 * - longest: 渡された records 範囲内での最大連続日数。トップ画面では直近
 *   STREAK_LOOKBACK_DAYS 日が渡される。歴代の最大を取りたいときは永続化
 *   テーブルでの集計が必要。
 *
 * 同じ JST 日に複数 record があっても 1 日として扱う。
 */
export function computeStreak(
  records: RecordRow[],
  type: FlowType,
  now: Date = new Date(),
): Streak {
  const days = new Set<string>();
  for (const r of records) {
    if (r.type !== type) continue;
    days.add(toJstDateKey(r.created_at));
  }
  if (days.size === 0) {
    return { current: 0, longest: 0, lastDate: null };
  }

  // 降順で並べた日付配列
  const sortedDesc = Array.from(days).sort().reverse();
  const lastDate = sortedDesc[0];

  // longest: 連続している日付の最大長
  const sortedAsc = sortedDesc.slice().reverse();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedAsc.length; i++) {
    if (shiftDays(sortedAsc[i - 1], 1) === sortedAsc[i]) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // current: 今日 or 昨日から遡って連続している日数。
  // それ以外の最新が一昨日以前なら 0 (既に途切れている)。
  const todayKey = toJstDateKey(now);
  const yesterdayKey = shiftDays(todayKey, -1);
  let current = 0;
  let cursor: string;
  if (days.has(todayKey)) {
    cursor = todayKey;
  } else if (days.has(yesterdayKey)) {
    cursor = yesterdayKey;
  } else {
    return { current: 0, longest, lastDate };
  }
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDays(cursor, -1);
  }

  return { current, longest, lastDate };
}
