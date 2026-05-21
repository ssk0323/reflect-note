import type { Streak } from "@/lib/records/streak";
import type { Achievement } from "@/lib/records/achievements";

type Props = {
  morningStreak: Streak;
  nightStreak: Streak;
  achievements: Achievement[];
  error?: string | null;
};

export function TopStreakChips({
  morningStreak,
  nightStreak,
  achievements,
  error,
}: Props) {
  if (error) {
    return (
      <p
        role="alert"
        className="sk-mono"
        style={{ color: "var(--color-warn)" }}
      >
        記録の読み込みに失敗しました
      </p>
    );
  }

  const badgeCount = achievements.length;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label="記録のサマリー"
    >
      <span className="sk-chip" aria-label={`朝のセットアップ ${morningStreak.current} 日連続`}>
        朝 {morningStreak.current}日連続
      </span>
      <span
        className="sk-chip sk-chip-accent"
        aria-label={`夜のリフレクション ${nightStreak.current} 日連続`}
      >
        夜 {nightStreak.current}日連続
      </span>
      {badgeCount > 0 && (
        <span className="sk-chip" aria-label={`獲得バッジ ${badgeCount} 個`}>
          バッジ {badgeCount}
        </span>
      )}
    </div>
  );
}
