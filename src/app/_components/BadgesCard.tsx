import type { Achievement } from "@/lib/records/achievements";

type Props = {
  achievements: Achievement[];
};

// バッジ種別ごとの絵文字
const ACHIEVEMENT_ICONS: Record<Achievement["code"], string> = {
  weekly_complete: "✅",
  monthly_complete: "📌",
  monthly_count: "🏆",
};

export function BadgesCard({ achievements }: Props) {
  return (
    <article
      aria-label="バッジ"
      className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">
          🏅
        </span>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          今のバッジ
        </h2>
      </div>

      {achievements.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          まだバッジはありません。週次・月次の入力を続けると獲得できます。
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {achievements.map((a) => (
            <li
              key={a.code}
              className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900"
            >
              <span aria-hidden className="text-2xl">
                {ACHIEVEMENT_ICONS[a.code]}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {a.title}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  {a.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
