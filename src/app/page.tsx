import Link from "next/link";
import type { Flow } from "@/lib/flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/lib/records/types";
import {
  getJstDayBoundsUtc,
  getJstMonthBoundsUtc,
  getJstWeekBoundsUtc,
  type BoundsUtc,
} from "@/lib/records/period";
import {
  formatJstMonth,
  formatJstShortDate,
} from "@/lib/records/group";
import {
  STREAK_LOOKBACK_DAYS,
  computeStreak,
} from "@/lib/records/streak";
import { computeAchievements } from "@/lib/records/achievements";
import { GoalCard, type CheckableField } from "./_components/GoalCard";
import { HeroCard, type HeroMode } from "./_components/HeroCard";
import { TopStreakChips } from "./_components/TopStreakChips";

export const dynamic = "force-dynamic";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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
    .limit(1000);

  if (error) {
    console.error("Failed to fetch recent records", error);
    return { records: [], error: error.message };
  }
  return { records: (data ?? []) as RecordRow[], error: null };
}

/** JST の時刻と、今日の morning/night の有無からヒーローの提案モードを決める。
 *  - 04:00-15:00: morning 未入力なら朝を提案、済なら夜（夕方寄りでも事前にプッシュ）
 *  - 15:00-04:00: night 未入力なら夜を提案、済なら done
 *  両方済んでいれば常に done。 */
function pickHeroMode(
  now: Date,
  todayMorning: RecordRow | null,
  todayNight: RecordRow | null,
): HeroMode {
  if (todayMorning && todayNight) return "done";
  const hourJst = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  const isMorningWindow = hourJst >= 4 && hourJst < 15;
  if (isMorningWindow) {
    return todayMorning ? "night" : "morning";
  }
  return todayNight ? "morning" : "night";
}

function pickGreeting(now: Date): string {
  const hourJst = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hourJst < 5) return "おやすみなさい";
  if (hourJst < 11) return "おはようございます";
  if (hourJst < 17) return "こんにちは";
  return "こんばんは";
}

const FLOW_LABELS_SHORT: Record<Flow["type"], string> = {
  morning: "朝のセットアップ",
  night: "夜の振り返り",
  weeklyGoal: "週の目標",
  weeklyReview: "週の振り返り",
  monthlyGoal: "月の目標",
  monthlyReview: "月の振り返り",
};

const dateMetaFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  weekday: "long",
});

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const dayBounds = getJstDayBoundsUtc(now);
  const weekBounds = getJstWeekBoundsUtc(now);
  const monthBounds = getJstMonthBoundsUtc(now);

  const lookbackShifted = new Date(
    now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const lookbackStart = getJstDayBoundsUtc(lookbackShifted).start;
  const { records: recentRecords, error: recentError } = await fetchRecentRecords(
    supabase,
    lookbackStart,
  );

  const morningStreak = computeStreak(recentRecords, "morning", now);
  const nightStreak = computeStreak(recentRecords, "night", now);
  const achievements = computeAchievements(recentRecords, now);

  const todayMorning = pickLatestInBounds(recentRecords, "morning", dayBounds);
  const todayNight = pickLatestInBounds(recentRecords, "night", dayBounds);
  const weeklyGoal = pickLatestInBounds(recentRecords, "weeklyGoal", weekBounds);
  const monthlyGoal = pickLatestInBounds(recentRecords, "monthlyGoal", monthBounds);

  const heroMode = pickHeroMode(now, todayMorning, todayNight);
  const greeting = pickGreeting(now);
  const dateMeta = dateMetaFormatter.format(now);

  const weekStartDate = new Date(weekBounds.start);
  const weekSundayDate = new Date(
    weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000,
  );
  const weekSubtitle = weeklyGoal
    ? `${formatJstShortDate(weekStartDate)} 〜 ${formatJstShortDate(weekSundayDate)}`
    : undefined;
  const monthSubtitle = monthlyGoal ? formatJstMonth(monthBounds.start) : undefined;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-7 sm:py-12">
      <header
        className="mb-6 flex flex-wrap items-end justify-between gap-3 pb-4"
        style={{ borderBottom: "1px dashed var(--color-line)" }}
      >
        <div>
          <p className="sk-eyebrow">{dateMeta}</p>
          <p className="sk-h mt-1">{greeting}</p>
        </div>
        <TopStreakChips
          morningStreak={morningStreak}
          nightStreak={nightStreak}
          achievements={achievements}
          error={recentError}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <HeroCard
          mode={heroMode}
          todayRecord={todayMorning}
          morningCheckables={MORNING_CHECKABLES}
          flowLabels={FLOW_LABELS_SHORT}
        />

        <aside className="flex flex-col gap-4" aria-label="今週と今月">
          <GoalCard
            title="今週の目標"
            emoji="🗓️"
            subtitle={weekSubtitle}
            record={weeklyGoal}
            checkableFields={WEEKLY_GOAL_CHECKABLES}
            emptyMessage="今週の目標はまだ設定されていません。"
            emptyCta={{ href: "/flows/weeklyGoal", label: "週の目標を設定する" }}
            editHref={weeklyGoal ? `/flows/weeklyGoal?edit=${weeklyGoal.id}` : undefined}
          />
          <GoalCard
            title="今月の目標"
            emoji="🎯"
            subtitle={monthSubtitle}
            record={monthlyGoal}
            checkableFields={MONTHLY_GOAL_CHECKABLES}
            emptyMessage="今月の目標はまだ設定されていません。"
            emptyCta={{ href: "/flows/monthlyGoal", label: "月の目標を設定する" }}
            editHref={monthlyGoal ? `/flows/monthlyGoal?edit=${monthlyGoal.id}` : undefined}
          />

          <Link
            href="/history"
            className="sk-mono text-center hover:text-[var(--color-ink)]"
          >
            ── 過去の記録を見る ──
          </Link>
        </aside>
      </div>

    </main>
  );
}
