import Link from "next/link";
import type { Flow } from "@/lib/flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/lib/records/types";
import { getJstDayBoundsUtc } from "@/lib/records/period";
import {
  formatJstMonth,
  formatJstShortDate,
} from "@/lib/records/group";
import {
  STREAK_LOOKBACK_DAYS,
  computeStreak,
} from "@/lib/records/streak";
import {
  addDays,
  addMonths,
  resolveRecordDate,
  startOfJstMonth,
  startOfJstWeek,
  toJstDateString,
} from "@/lib/records/targetDate";
import {
  fetchTodosForDate,
  fetchYesterdayPendingTodos,
} from "@/app/_todos/actions";
import {
  HeaderRitualButtons,
  type RitualKind,
} from "./_components/HeaderRitualButtons";
import { YesterdayMessage } from "./_components/YesterdayMessage";
import { GoalsStrip } from "./_components/GoalsStrip";
import { TodoCard } from "./_components/TodoCard";

export const dynamic = "force-dynamic";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function pickLatestInBoundsByDateRange(
  records: RecordRow[],
  type: Flow["type"],
  startDate: string,
  endDateExclusive: string,
): RecordRow | null {
  let latest: RecordRow | null = null;
  let latestCreatedMs = -Infinity;
  for (const r of records) {
    if (r.type !== type) continue;
    const key = resolveRecordDate(r);
    if (key < startDate || key >= endDateExclusive) continue;
    const createdMs = Date.parse(r.created_at);
    if (createdMs > latestCreatedMs) {
      latest = r;
      latestCreatedMs = createdMs;
    }
  }
  return latest;
}

async function fetchRecentRecords(
  supabase: SupabaseServerClient,
  lookbackDate: string,
  lookbackStartUtc: string,
): Promise<{ records: RecordRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("records")
    .select("id, type, answers, checks, target_date, created_at, updated_at")
    .or(
      `target_date.gte.${lookbackDate},` +
        `and(target_date.is.null,created_at.gte."${lookbackStartUtc}")`,
    )
    .order("target_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Failed to fetch recent records", error);
    return { records: [], error: error.message };
  }
  return { records: (data ?? []) as RecordRow[], error: null };
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

/** 今が「朝/昼/夜」のどれか。儀式ボタンの active highlight に使う。 */
function pickTimeOfDay(now: Date): "morning" | "day" | "evening" {
  const hourJst = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hourJst >= 4 && hourJst < 11) return "morning";
  if (hourJst >= 17 || hourJst < 4) return "evening";
  return "day";
}

const dateMetaFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const todayLabelFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const yesterdayMetaFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();

  // 過去 STREAK_LOOKBACK_DAYS 日分の records を 1 query で取得する。
  const lookbackShifted = new Date(
    now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const lookbackStartUtc = getJstDayBoundsUtc(lookbackShifted).start;
  const lookbackDate = toJstDateString(lookbackShifted);

  const { records: recentRecords } = await fetchRecentRecords(
    supabase,
    lookbackDate,
    lookbackStartUtc,
  );

  const morningStreak = computeStreak(recentRecords, "morning", now);
  const nightStreak = computeStreak(recentRecords, "night", now);

  // 期間境界を JST 日付文字列で表現する。
  const todayKey = toJstDateString(now);
  const dayEndExclusive = addDays(todayKey, 1);
  const yesterdayKey = addDays(todayKey, -1);
  const weekStart = startOfJstWeek(todayKey);
  const weekEndExclusive = addDays(weekStart, 7);
  const monthStart = startOfJstMonth(todayKey);
  const monthEndExclusive = addMonths(monthStart, 1);

  // 今日 / 今週 / 今月 の最新 record
  const todayMorning = pickLatestInBoundsByDateRange(
    recentRecords,
    "morning",
    todayKey,
    dayEndExclusive,
  );
  const todayNight = pickLatestInBoundsByDateRange(
    recentRecords,
    "night",
    todayKey,
    dayEndExclusive,
  );
  // 昨日の night record (= 「明日の自分へひとこと」を取り出す元)
  const yesterdayNight = pickLatestInBoundsByDateRange(
    recentRecords,
    "night",
    yesterdayKey,
    todayKey,
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

  // ToDo: 今日のリスト + 昨日の未完了 (朝の時間帯のみ提案表示)
  const { todos } = await fetchTodosForDate(todayKey);
  const timeOfDay = pickTimeOfDay(now);
  const { todos: yesterdayPending } =
    timeOfDay === "morning"
      ? await fetchYesterdayPendingTodos(todayKey)
      : { todos: [] };

  const greeting = pickGreeting(now);
  const dateMeta = dateMetaFormatter.format(now);

  // 儀式ボタンの状態
  const rituals: {
    kind: RitualKind;
    done: boolean;
    active: boolean;
    doneTime?: string;
    href: string;
  }[] = [
    {
      kind: "morning",
      done: !!todayMorning,
      active: timeOfDay === "morning" && !todayMorning,
      doneTime: todayMorning
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(todayMorning.created_at))
        : undefined,
      href: todayMorning
        ? `/flows/morning?edit=${todayMorning.id}`
        : "/flows/morning",
    },
    {
      kind: "evening",
      done: !!todayNight,
      active: timeOfDay === "evening" && !todayNight,
      doneTime: todayNight
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(todayNight.created_at))
        : undefined,
      href: todayNight ? `/flows/night?edit=${todayNight.id}` : "/flows/night",
    },
    // 週/月の振り返りボタンは「常に表示」(チャットの仕様確認より)
    { kind: "weekReview", done: false, active: false, href: "/flows/weeklyReview" },
    { kind: "monthReview", done: false, active: false, href: "/flows/monthlyReview" },
  ];

  // 今週・今月のラベル
  const weekStartDate = new Date(`${weekStart}T00:00:00+09:00`);
  const weekSundayDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekRangeLabel = `${formatJstShortDate(weekStartDate)} → ${formatJstShortDate(weekSundayDate)}`;
  const monthLabel = formatJstMonth(new Date(`${monthStart}T00:00:00+09:00`));

  // 残り日数 / 残り日数文言
  const daysToWeekEnd = Math.max(
    0,
    Math.ceil(
      (Date.parse(`${weekEndExclusive}T00:00:00+09:00`) - now.getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  const daysToMonthEnd = Math.max(
    0,
    Math.ceil(
      (Date.parse(`${monthEndExclusive}T00:00:00+09:00`) - now.getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );

  // 昨日からのメッセージ
  const yesterdayMessage =
    yesterdayNight?.answers.messageToTomorrowSelf?.trim() ?? "";
  const yesterdayMeta = yesterdayNight
    ? yesterdayMetaFormatter.format(new Date(yesterdayNight.created_at))
    : "";
  const yesterdayHref = yesterdayNight
    ? `/flows/night?edit=${yesterdayNight.id}`
    : "/history";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-7 sm:py-10">
      {/* Header */}
      <header
        className="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3"
        style={{ borderBottom: "1px dashed var(--color-line)" }}
      >
        <div>
          <p className="sk-eyebrow">{dateMeta}</p>
          <p className="sk-h mt-0.5">{greeting}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderRitualButtons rituals={rituals} />
          <span
            aria-hidden
            style={{
              width: 1,
              height: 18,
              background: "var(--color-line)",
              margin: "0 4px",
            }}
            className="hidden sm:inline-block"
          />
          <span className="sk-chip" aria-label={`朝のセットアップ ${morningStreak.current} 日連続`}>
            朝 {morningStreak.current}日
          </span>
          <span className="sk-chip" aria-label={`夜のリフレクション ${nightStreak.current} 日連続`}>
            夜 {nightStreak.current}日
          </span>
          <span
            aria-hidden
            style={{
              width: 1,
              height: 18,
              background: "var(--color-line)",
              margin: "0 4px",
            }}
            className="hidden sm:inline-block"
          />
          <Link
            href="/history"
            className="sk-mono hover:text-[var(--color-ink)]"
          >
            履歴
          </Link>
        </div>
      </header>

      {/* 昨日からのメッセージ */}
      <YesterdayMessage
        message={yesterdayMessage}
        meta={yesterdayMeta}
        href={yesterdayHref}
      />

      {/* 目標ストリップ */}
      <GoalsStrip
        today={todayMorning}
        week={weeklyGoal}
        month={monthlyGoal}
        todayLabel={todayLabelFormatter.format(now)}
        weekRangeLabel={weekRangeLabel}
        weekRemainingLabel={`残り ${daysToWeekEnd}日`}
        monthLabel={monthLabel}
        monthRemainingLabel={`残り ${daysToMonthEnd}日`}
      />

      {/* ToDo カード */}
      <TodoCard
        todos={todos}
        todayDate={todayKey}
        showCarryAction={timeOfDay === "evening"}
        carryProposal={yesterdayPending}
      />
    </main>
  );
}
