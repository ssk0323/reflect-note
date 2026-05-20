import type { Streak } from "@/lib/records/streak";

type Props = {
  morningStreak: Streak;
  nightStreak: Streak;
  error?: string | null;
};

export function StreakCard({ morningStreak, nightStreak, error }: Props) {
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

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:bg-red-950 dark:text-red-200"
        >
          ストリークを読み込めませんでした。時間をおいて再度お試しください。
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      )}
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
  const isBroken = streak.current === 0 && streak.longest > 0;
  // 数値+「日連続」を SR が連続して読み上げるように aria-label を明示する
  const currentLabel = `${label}: 現在 ${streak.current} 日連続`;

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

      {isBroken ? (
        <>
          <p
            className="mt-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400"
            aria-label={`${label}: 途切れています`}
          >
            <span aria-hidden>途切れています</span>
          </p>
          <p
            className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
            aria-label={`最長 ${streak.longest} 日`}
          >
            <span aria-hidden>最長 {streak.longest} 日</span>
          </p>
        </>
      ) : (
        <>
          <p
            className={`mt-2 text-2xl font-bold ${
              streak.current === 0
                ? "text-zinc-400 dark:text-zinc-500"
                : "text-zinc-900 dark:text-zinc-50"
            }`}
            aria-label={currentLabel}
          >
            <span aria-hidden>
              {streak.current}{" "}
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                日連続
              </span>
            </span>
          </p>
          {streak.longest > streak.current && (
            <p
              className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
              aria-label={`最長 ${streak.longest} 日`}
            >
              <span aria-hidden>最長 {streak.longest} 日</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
