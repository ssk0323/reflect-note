import Link from "next/link";
import { definedFlows, type Flow } from "@/lib/flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/lib/records/types";
import {
  getJstDayBoundsUtc,
  getJstMonthBoundsUtc,
  getJstWeekBoundsUtc,
  type BoundsUtc,
} from "@/lib/records/period";
import {
  STREAK_LOOKBACK_DAYS,
  computeStreak,
} from "@/lib/records/streak";
import { computeAchievements } from "@/lib/records/achievements";
import { BadgesCard } from "./_components/BadgesCard";
import { GoalCard, type CheckableField } from "./_components/GoalCard";
import { StreakCard } from "./_components/StreakCard";

export const dynamic = "force-dynamic";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const flowMeta: Record<Flow["type"], { emoji: string; description: string }> = {
  morning: { emoji: "🌅", description: "今日の目標とタスク3つを決めます。" },
  night: { emoji: "🌙", description: "今日を振り返り、明日につなげます。" },
  weeklyGoal: { emoji: "🗓️", description: "今週の目標と優先タスクを決めます。" },
  weeklyReview: { emoji: "✅", description: "今週できたこと、学び、来週のTryを書きます。" },
  monthlyGoal: { emoji: "🎯", description: "今月の目標、テーマ、重点タスクを決めます。" },
  monthlyReview: { emoji: "📌", description: "今月の成果、学び、来月のTryを書きます。" },
};

const flowOrder: Flow["type"][] = [
  "morning",
  "night",
  "weeklyGoal",
  "weeklyReview",
  "monthlyGoal",
  "monthlyReview",
];

const MORNING_CHECKABLES: CheckableField[] = [
  { key: "goal", kind: "goal", label: "目標" },
  { key: "task1", kind: "task", label: "タスク 1" },
  { key: "task2", kind: "task", label: "タスク 2" },
  { key: "task3", kind: "task", label: "タスク 3" },
];

const WEEKLY_GOAL_CHECKABLES: CheckableField[] = [
  { key: "weekGoal", kind: "goal", label: "今週の目標" },
  { key: "weekPriority1", kind: "task", label: "優先タスク 1" },
  { key: "weekPriority2", kind: "task", label: "優先タスク 2" },
  { key: "weekPriority3", kind: "task", label: "優先タスク 3" },
];

const MONTHLY_GOAL_CHECKABLES: CheckableField[] = [
  { key: "monthGoal", kind: "goal", label: "今月の目標" },
  { key: "monthPriority1", kind: "task", label: "重点タスク 1" },
  { key: "monthPriority2", kind: "task", label: "重点タスク 2" },
  { key: "monthPriority3", kind: "task", label: "重点タスク 3" },
];

// recentRecords (created_at desc) から、指定 type かつ指定期間内の
// 最新 1 件を返す。降順なので最初に一致したものが最新。
function pickLatestInBounds(
  records: RecordRow[],
  type: Flow["type"],
  bounds: BoundsUtc,
): RecordRow | null {
  const startMs = Date.parse(bounds.start);
  const endMs = Date.parse(bounds.end);
  for (const r of records) {
    if (r.type !== type) continue;
    const t = Date.parse(r.created_at);
    if (t >= startMs && t < endMs) return r;
  }
  return null;
}

async function fetchRecentRecords(
  supabase: SupabaseServerClient,
  lookbackStart: string,
): Promise<{ records: RecordRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("records")
    .select("id, type, answers, checks, created_at, updated_at")
    .gte("created_at", lookbackStart)
    .order("created_at", { ascending: false })
    .limit(1000); // PostgREST デフォルト上限 (1000) での silent truncation を明示

  if (error) {
    console.error("Failed to fetch recent records", error);
    return { records: [], error: error.message };
  }
  return { records: (data ?? []) as RecordRow[], error: null };
}

export default async function Home() {
  // 全カードで同じ supabase client を共有 (cookies() + client 生成を 1 回に集約)
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const dayBounds = getJstDayBoundsUtc(now);
  const weekBounds = getJstWeekBoundsUtc(now);
  const monthBounds = getJstMonthBoundsUtc(now);

  // 過去 35 日分の records を 1 query で取得する。
  // 「本日の morning」「今週の weeklyGoal」「今月の monthlyGoal」も
  // すべてこの期間に含まれるので、追加 fetch せずメモリ派生する。
  const lookbackStart = new Date(
    now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { records: recentRecords, error: recentError } = await fetchRecentRecords(
    supabase,
    lookbackStart,
  );

  const morningStreak = computeStreak(recentRecords, "morning", now);
  const nightStreak = computeStreak(recentRecords, "night", now);
  const achievements = computeAchievements(recentRecords, now);

  const today = pickLatestInBounds(recentRecords, "morning", dayBounds);
  const weeklyGoal = pickLatestInBounds(recentRecords, "weeklyGoal", weekBounds);
  const monthlyGoal = pickLatestInBounds(recentRecords, "monthlyGoal", monthBounds);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:py-12">
      <header className="rounded-3xl bg-zinc-900 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-zinc-300">reflect-note</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          朝に整え、夜に振り返る。
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
          今日・今週・今月の目標を一覧で確認し、達成したらチェックを付けます。
        </p>
      </header>

      <section
        aria-label="現在の目標"
        className="mt-6 grid gap-4 md:grid-cols-3"
      >
        <GoalCard
          title="本日の目標"
          emoji="🌅"
          record={today}
          checkableFields={MORNING_CHECKABLES}
          emptyMessage="本日の目標はまだ設定されていません。"
          emptyCta={{ href: "/flows/morning", label: "朝のセットアップを始める" }}
          editHref={today ? `/flows/morning?edit=${today.id}` : undefined}
        />
        <GoalCard
          title="今週の目標"
          emoji="🗓️"
          record={weeklyGoal}
          checkableFields={WEEKLY_GOAL_CHECKABLES}
          emptyMessage="今週の目標はまだ設定されていません。"
          emptyCta={{ href: "/flows/weeklyGoal", label: "週の目標を設定する" }}
          editHref={weeklyGoal ? `/flows/weeklyGoal?edit=${weeklyGoal.id}` : undefined}
        />
        <GoalCard
          title="今月の目標"
          emoji="🎯"
          record={monthlyGoal}
          checkableFields={MONTHLY_GOAL_CHECKABLES}
          emptyMessage="今月の目標はまだ設定されていません。"
          emptyCta={{ href: "/flows/monthlyGoal", label: "月の目標を設定する" }}
          editHref={monthlyGoal ? `/flows/monthlyGoal?edit=${monthlyGoal.id}` : undefined}
        />
      </section>

      <section
        aria-label="ストリークとバッジ"
        className="mt-6 grid gap-4 md:grid-cols-2"
      >
        <StreakCard
          morningStreak={morningStreak}
          nightStreak={nightStreak}
          error={recentError}
        />
        <BadgesCard achievements={achievements} error={recentError} />
      </section>

      <h2 className="mt-10 text-sm font-bold text-zinc-500">入力フローを開く</h2>
      <section className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flowOrder.map((type) => {
          const flow = definedFlows[type];
          const meta = flowMeta[type];
          return (
            <Link
              key={type}
              href={`/flows/${type}`}
              className="group block rounded-3xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="text-3xl" aria-hidden>
                {meta.emoji}
              </div>
              <h3 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {flow.label}
              </h3>
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
