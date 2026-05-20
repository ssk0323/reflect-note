import Link from "next/link";
import { definedFlows, type Flow } from "@/lib/flows";

const flowMeta: Record<Flow["type"], { emoji: string; description: string }> = {
  morning: {
    emoji: "🌅",
    description: "今日の目標とタスク3つを決めます。",
  },
  night: {
    emoji: "🌙",
    description: "今日を振り返り、明日につなげます。",
  },
  weeklyGoal: {
    emoji: "🗓️",
    description: "今週の目標と優先タスクを決めます。",
  },
  weeklyReview: {
    emoji: "✅",
    description: "今週できたこと、学び、来週のTryを書きます。",
  },
  monthlyGoal: {
    emoji: "🎯",
    description: "今月の目標、テーマ、重点タスクを決めます。",
  },
  monthlyReview: {
    emoji: "📌",
    description: "今月の成果、学び、来月のTryを書きます。",
  },
};

const flowOrder: Flow["type"][] = [
  "morning",
  "night",
  "weeklyGoal",
  "weeklyReview",
  "monthlyGoal",
  "monthlyReview",
];

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:py-12">
      <header className="rounded-3xl bg-zinc-900 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-zinc-300">reflect-note</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          朝に整え、夜に振り返る。
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
          1日・1週間・1ヶ月の目標と振り返りを、一問一答で短く記録します。
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flowOrder.map((type) => {
          const flow = definedFlows[type];
          const meta = flowMeta[type];
          return (
            <Link
              key={type}
              href={`/flows/${type}`}
              className="group block rounded-3xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="text-3xl">{meta.emoji}</div>
              <h2 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {flow.label}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {meta.description}
              </p>
              <p className="mt-5 text-sm font-bold text-zinc-900 group-hover:underline dark:text-zinc-50">
                始める →
              </p>
            </Link>
          );
        })}
      </section>

      <section className="mt-6 flex justify-end">
        <Link
          href="/history"
          className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          過去の記録を見る →
        </Link>
      </section>
    </main>
  );
}
