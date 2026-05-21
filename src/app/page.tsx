import Link from "next/link";
import type { Flow } from "@/lib/flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/lib/records/types";
import {
  getJstDayBoundsUtc,
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
import {
  addDays,
  resolveRecordDate,
  startOfJstMonth,
  startOfJstWeek,
  toJstDateString,
} from "@/lib/records/targetDate";
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

// recentRecords (created_at desc) から、指定 type かつ指定期間内の最新 1 件を返す。
// 期間判定は target_date (あれば) → created_at の JST 日付 (Issue #30) で行う。
function pickLatestInBoundsByDateRange(
  records: RecordRow[],
  type: Flow["type"],
  startDate: string, // YYYY-MM-DD (inclusive)
  endDateExclusive: string, // YYYY-MM-DD (exclusive)
): RecordRow | null {
  for (const r of records) {
    if (r.type !== type) continue;
    const key = resolveRecordDate(r);
    if (key >= startDate && key < endDateExclusive) return r;
  }
  return null;
}

async function fetchRecentRecords(
  supabase: SupabaseServerClient,
  lookbackDate: string, // YYYY-MM-DD: target_date がこの日以降のレコードを拾う
  lookbackStartUtc: string, // ISO UTC: NULL target_date は created_at でフォールバック
): Promise<{ records: RecordRow[]; error: string | null }> {
  // target_date が設定されたレコードは target_date >= lookbackDate で判定し、
  // target_date が NULL の旧レコードは created_at >= lookbackStartUtc で判定する。
  // これにより、例えば monthlyGoal "再来月" を 2 ヶ月前に書いた場合でも、
  // 今月になったタイミングで target_date が一致して Home に表示される
  // (created_at のみのフィルタだと 35 日 lookback の外に落ちる)。
  const { data, error } = await supabase
    .from("records")
    .select("id, type, answers, checks, target_date, created_at, updated_at")
    .or(
      `target_date.gte.${lookbackDate},` +
        `and(target_date.is.null,created_at.gte.${lookbackStartUtc})`,
    )
    .order("created_at", { ascending: false })
    .limit(1000); // PostgREST デフォルト上限 (1000) での silent truncation を明示

  if (error) {
    console.error("Failed to fetch recent records", error);
    return { records: [], error: error.message };
  }
  return { records: (data ?? []) as RecordRow[], error: null };
}

/** JST の時刻と、今日の morning/night の有無からヒーローの提案モードを決める。
 *
 *  ルール:
 *  - 両方済 → "done"
 *  - どちらか片方済 → 書いてない方を提案 (時間帯に関わらず)
 *  - 両方未済 → 04:00-15:00 は "morning"、それ以外は "night"
 *
 *  片方済の場合に時間帯を無視する理由: 例えば夜 22 時に night 未入力で morning 済の
 *  ケースは「夜を書きに来ている」のが自然。逆に朝 6 時に morning 未入力で night 済の
 *  (前夜が遅すぎて翌朝に night を書いた) ケースは「朝を書きに来ている」のが自然。 */
function pickHeroMode(
  now: Date,
  todayMorning: RecordRow | null,
  todayNight: RecordRow | null,
): HeroMode {
  if (todayMorning && todayNight) return "done";
  if (todayMorning) return "night";
  if (todayNight) return "morning";
  const hourJst = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  return hourJst >= 4 && hourJst < 15 ? "morning" : "night";
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

  // 過去 STREAK_LOOKBACK_DAYS 日分の records を 1 query で取得する。
  // lookback の開始は「N 日前の JST 00:00」に丸める (現在時刻が正午のときに
  // 最古日の午前分が漏れるのを防ぐ)。
  const lookbackShifted = new Date(
    now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const lookbackStartUtc = getJstDayBoundsUtc(lookbackShifted).start;
  const lookbackDate = toJstDateString(lookbackShifted);

  const { records: recentRecords, error: recentError } = await fetchRecentRecords(
    supabase,
    lookbackDate,
    lookbackStartUtc,
  );

  const morningStreak = computeStreak(recentRecords, "morning", now);
  const nightStreak = computeStreak(recentRecords, "night", now);
  const achievements = computeAchievements(recentRecords, now);

  // 期間境界を JST 日付文字列で表現する。
  // - 今日: dayStart 〜 dayStart+1 日
  // - 今週: 月曜 〜 翌月曜
  // - 今月: 月初 〜 翌月初
  const todayKey = toJstDateString(now);
  const dayStart = todayKey;
  const dayEndExclusive = addDays(dayStart, 1);
  const weekStart = startOfJstWeek(todayKey);
  const weekEndExclusive = addDays(weekStart, 7);
  const monthStart = startOfJstMonth(todayKey);
  // 翌月 1 日 = monthStart の年月を +1
  const [my, mm] = monthStart.split("-").map(Number);
  const nextMy = mm === 12 ? my + 1 : my;
  const nextMm = mm === 12 ? 1 : mm + 1;
  const monthEndExclusive = `${String(nextMy).padStart(4, "0")}-${String(nextMm).padStart(2, "0")}-01`;

  const todayMorning = pickLatestInBoundsByDateRange(
    recentRecords,
    "morning",
    dayStart,
    dayEndExclusive,
  );
  const todayNight = pickLatestInBoundsByDateRange(
    recentRecords,
    "night",
    dayStart,
    dayEndExclusive,
  );
  const weeklyGoal = pickLatestInBoundsByDateRange(
    recentRecords,
    "weeklyGoal",
    weekStart,
    weekEndExclusive,
  );
  const monthlyGoal = pickLatestInBoundsByDateRange(
    recentRecords,
    "monthlyGoal",
    monthStart,
    monthEndExclusive,
  );

  const heroMode = pickHeroMode(now, todayMorning, todayNight);
  const greeting = pickGreeting(now);
  const dateMeta = dateMetaFormatter.format(now);

  const weekStartDate = new Date(`${weekStart}T00:00:00+09:00`);
  const weekSundayDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekSubtitle = weeklyGoal
    ? `${formatJstShortDate(weekStartDate)} 〜 ${formatJstShortDate(weekSundayDate)}`
    : undefined;
  const monthSubtitle = monthlyGoal
    ? formatJstMonth(new Date(`${monthStart}T00:00:00+09:00`))
    : undefined;

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
