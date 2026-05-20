import type { RecordRow } from "./types";
import {
  getJstMonthBoundsUtc,
  getJstWeekBoundsUtc,
  type BoundsUtc,
} from "./period";

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

function withinBounds(record: RecordRow, bounds: BoundsUtc): boolean {
  // bounds は `new Date().toISOString()` 由来でミリ秒 3 桁の `Z` 表記固定だが、
  // record.created_at は Supabase 側で `+00:00` 表記やマイクロ秒精度になる
  // 可能性があり、文字列比較だと境界で誤判定する。Date.parse でタイムスタンプ
  // 数値化してから比較する。
  const t = Date.parse(record.created_at);
  return t >= Date.parse(bounds.start) && t < Date.parse(bounds.end);
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

  const weekBounds = getJstWeekBoundsUtc(now);
  const monthBounds = getJstMonthBoundsUtc(now);

  const weekRecords = records.filter((r) => withinBounds(r, weekBounds));
  const monthRecords = records.filter((r) => withinBounds(r, monthBounds));

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
