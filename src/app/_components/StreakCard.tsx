import type { Streak } from "@/lib/records/streak";

type Props = {
  morningStreak: Streak;
  nightStreak: Streak;
};

export function StreakCard({ morningStreak, nightStreak }: Props) {
  return (
    <article
      aria-label="ストリーク"
      className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">
          🔥
        </span>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          ストリーク
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StreakItem
          icon="🌅"
          label="朝のセットアップ"
          streak={morningStreak}
        />
        <StreakItem
          icon="🌙"
          label="夜のリフレクション"
          streak={nightStreak}
        />
      </div>
    </article>
  );
}

function StreakItem({
  icon,
  label,
  streak,
}: {
  icon: string;
  label: string;
  streak: Streak;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          {icon}
        </span>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
      </div>
      <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {streak.current}{" "}
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          日連続
        </span>
      </p>
      {streak.longest > streak.current && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          最長 {streak.longest} 日
        </p>
      )}
    </div>
  );
}
