import type { RecordRow } from "./types";
import {
  getJstMonthBoundsUtc,
  getJstWeekBoundsUtc,
  type BoundsUtc,
} from "./period";
import { resolveRecordDate, toJstDateString } from "./targetDate";

// 月間達成バッジのしきい値 (デフォルト: 月 20 件以上)
export const MONTHLY_COUNT_THRESHOLD = 20;

export type AchievementCode =
  | "weekly_complete"
  | "monthly_complete"
  | "monthly_count";

export type Achievement = {
  code: AchievementCode;
  title: string;
  description: string;
};

/** bounds の start/end を JST 日付文字列に変換しておき、レコードごとの再計算を避ける。 */
function toJstDateRange(bounds: BoundsUtc): { start: string; end: string } {
  return {
    start: toJstDateString(new Date(bounds.start)),
    end: toJstDateString(new Date(bounds.end)),
  };
}

function withinRange(
  record: RecordRow,
  range: { start: string; end: string },
): boolean {
  // target_date があれば「いつのための記録か」を優先 (Issue #30)。
  const recordDate = resolveRecordDate(record);
  return recordDate >= range.start && recordDate < range.end;
}

/**
 * 現在の週/月で達成しているバッジ一覧を返す。
 *
 * 過去のバッジ (先週/先月分) はここでは扱わない。MVP では「今のモチベ」
 * を可視化する目的に絞る。将来的に永続化する場合は achievements
 * テーブルに INSERT する形で拡張する。
 */
export function computeAchievements(
  records: RecordRow[],
  now: Date = new Date(),
): Achievement[] {
  const result: Achievement[] = [];

  // bounds を JST 日付文字列に 1 度だけ変換する (records 件数分の再計算を避ける)。
  const weekRange = toJstDateRange(getJstWeekBoundsUtc(now));
  const monthRange = toJstDateRange(getJstMonthBoundsUtc(now));

  const weekRecords = records.filter((r) => withinRange(r, weekRange));
  const monthRecords = records.filter((r) => withinRange(r, monthRange));

  if (
    weekRecords.some((r) => r.type === "weeklyGoal") &&
    weekRecords.some((r) => r.type === "weeklyReview")
  ) {
    result.push({
      code: "weekly_complete",
      title: "今週の入力コンプリート",
      description: "今週の目標設定と振り返りの両方を入力しました。",
    });
  }

  if (
    monthRecords.some((r) => r.type === "monthlyGoal") &&
    monthRecords.some((r) => r.type === "monthlyReview")
  ) {
    result.push({
      code: "monthly_complete",
      title: "今月の入力コンプリート",
      description: "今月の目標設定と振り返りの両方を入力しました。",
    });
  }

  if (monthRecords.length >= MONTHLY_COUNT_THRESHOLD) {
    result.push({
      code: "monthly_count",
      title: `月間 ${MONTHLY_COUNT_THRESHOLD} 回達成`,
      description: `今月 ${monthRecords.length} 件の記録を達成しました。`,
    });
  }

  return result;
}
