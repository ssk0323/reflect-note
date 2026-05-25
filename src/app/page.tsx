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
  diffDays,
  isValidDateString,
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
import { DateNavigator } from "./_components/DateNavigator";

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

/** JST 時刻を 0-23 の数値で返す。 */
function getJstHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
}

/** 挨拶と時間帯を 1 つの hour 基準で揃える (team review P1: 境界不整合)。
 *  - 04:00-10:59 → 朝モード / "おはようございます"
 *  - 11:00-16:59 → 昼モード / "こんにちは"
 *  - 17:00-03:59 → 夜モード / "こんばんは" (04:00 未満は前夜扱い) */
function pickGreeting(now: Date): string {
  const h = getJstHour(now);
  if (h >= 4 && h < 11) return "おはようございます";
  if (h >= 11 && h < 17) return "こんにちは";
  return "こんばんは";
}

function pickTimeOfDay(now: Date): "morning" | "day" | "evening" {
  const h = getJstHour(now);
  if (h >= 4 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  return "evening";
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

// 通常は "5/20 23:14"。ただし year またぎ (今年と作成年が違う) の場合は
// "2025/12/31 23:14" のように年を表示する。
const yesterdayMetaSameYearFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const yesterdayMetaCrossYearFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const yearJstFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
});
function formatYesterdayMeta(created: Date, now: Date): string {
  const createdYear = yearJstFormatter.format(created);
  const nowYear = yearJstFormatter.format(now);
  return (createdYear === nowYear
    ? yesterdayMetaSameYearFormatter
    : yesterdayMetaCrossYearFormatter
  ).format(created);
}

type HomePageProps = {
  searchParams?: Promise<{ date?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const jstHour = getJstHour(now);

  // 「業務日 (business day)」概念: 00:00-03:59 (JST) は前日の続きとして扱う
  // (pickTimeOfDay の "evening" 範囲と一致させ、日付境界の不整合を防ぐ;
  //  Round 11 Copilot review)。これをやらないと 01:00 で「夜モード」かつ
  // 「今日 ToDo を carry」のような矛盾が起きる。
  const calendarTodayKey = toJstDateString(now);
  const businessTodayKey =
    jstHour < 4 ? addDays(calendarTodayKey, -1) : calendarTodayKey;
  const businessTomorrowKey = addDays(businessTodayKey, 1);

  // Issue #46: 表示中の日付。?date= で指定された場合は (バリデーション後) それを採用、
  // 未指定 or 不正なら business day の今日。
  const dateParam = (await searchParams)?.date;
  const todayKey =
    dateParam && isValidDateString(dateParam) ? dateParam : businessTodayKey;
  const isViewingToday = todayKey === businessTodayKey;

  // 表示用 (date meta) / streak 計算用に business day を表す Date を作る。
  // 正午にしておけば JST→UTC 変換時の off-by-one を避けられる。
  // streak は実時刻 (business day) ベースで計算するので businessTodayKey を使う。
  const businessNow =
    jstHour < 4 ? new Date(`${businessTodayKey}T12:00:00+09:00`) : now;

  // 過去 STREAK_LOOKBACK_DAYS 日分の records を 1 query で取得する。
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

  const morningStreak = computeStreak(recentRecords, "morning", businessNow);
  const nightStreak = computeStreak(recentRecords, "night", businessNow);

  // 期間境界を JST 日付文字列で表現する (todayKey が business day 基準なので
  // week/month も自動的に business day で揃う)。
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
  // 週/月の振り返り (Round 5 Copilot review): ヘッダーボタンの「完了済表示」用。
  // 今週/今月の最新 weeklyReview / monthlyReview があれば done=true で時刻表示。
  const weeklyReview = pickLatestInBoundsByDateRange(
    recentRecords,
    "weeklyReview",
    weekStart,
    weekEndExclusive,
  );
  const monthlyReview = pickLatestInBoundsByDateRange(
    recentRecords,
    "monthlyReview",
    monthStart,
    monthEndExclusive,
  );

  // ToDo: 表示日 (= 今日 or 別日) のリスト。
  // 昨日の未完了の carry 提案は「今日を見ている朝モード」の時だけ意味があるので
  // それ以外 (= 明日を見ている等) はスキップ (Issue #46)。
  const { todos, error: todosError } = await fetchTodosForDate(todayKey);
  const timeOfDay = pickTimeOfDay(now);
  const { todos: yesterdayPending, error: yesterdayPendingError } =
    isViewingToday && timeOfDay === "morning"
      ? await fetchYesterdayPendingTodos(todayKey)
      : { todos: [], error: null };

  // データ取得エラーをまとめて UI に出すための集約。サイレント空表示は
  // 「データが無いのか / 取得に失敗したのか」をユーザーが区別できないため避ける
  // (Copilot review round 4)。
  const dataErrors = [recentError, todosError, yesterdayPendingError].filter(
    (e): e is string => typeof e === "string" && e.length > 0,
  );

  // 挨拶は実時刻ベース ("こんばんは" は 23:30 にも 01:30 にも自然)。
  // 日付ラベルは business day ベース (00:00-03:59 に翌日表示にならないよう)。
  const greeting = pickGreeting(now);
  const dateMeta = dateMetaFormatter.format(businessNow);

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
      active: isViewingToday && timeOfDay === "morning" && !todayMorning,
      doneTime: todayMorning
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(todayMorning.created_at))
        : undefined,
      // Issue #46: 表示日に record が無ければ ?date= 付きで create リンクに
      href: todayMorning
        ? `/flows/morning?edit=${todayMorning.id}`
        : isViewingToday
          ? "/flows/morning"
          : `/flows/morning?date=${todayKey}`,
    },
    {
      kind: "evening",
      done: !!todayNight,
      active: isViewingToday && timeOfDay === "evening" && !todayNight,
      doneTime: todayNight
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(todayNight.created_at))
        : undefined,
      href: todayNight
        ? `/flows/night?edit=${todayNight.id}`
        : isViewingToday
          ? "/flows/night"
          : `/flows/night?date=${todayKey}`,
    },
    // 週/月の振り返りボタンは「常に表示」(チャットの仕様確認より)。
    // 完了済 (今週/今月の review record あり) なら done=true + doneTime + edit href。
    {
      kind: "weekReview",
      done: !!weeklyReview,
      active: false,
      doneTime: weeklyReview
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(weeklyReview.created_at))
        : undefined,
      href: weeklyReview
        ? `/flows/weeklyReview?edit=${weeklyReview.id}`
        : "/flows/weeklyReview",
    },
    {
      kind: "monthReview",
      done: !!monthlyReview,
      active: false,
      doneTime: monthlyReview
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(monthlyReview.created_at))
        : undefined,
      href: monthlyReview
        ? `/flows/monthlyReview?edit=${monthlyReview.id}`
        : "/flows/monthlyReview",
    },
  ];

  // 今週・今月のラベル
  const weekStartDate = new Date(`${weekStart}T00:00:00+09:00`);
  const weekSundayDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekRangeLabel = `${formatJstShortDate(weekStartDate)} → ${formatJstShortDate(weekSundayDate)}`;
  const monthLabel = formatJstMonth(new Date(`${monthStart}T00:00:00+09:00`));

  // 残り日数: 日付ベースで安定した計算 (team review P1: Math.ceil の時刻依存を排除)。
  // 「今日含む」定義: 日曜日に「残り 1 日」と出す = diffDays(end, today)。
  // 月曜表示なら 7 日、土曜なら 2 日、日曜なら 1 日。
  const daysToWeekEnd = Math.max(0, diffDays(weekEndExclusive, todayKey));
  const daysToMonthEnd = Math.max(0, diffDays(monthEndExclusive, todayKey));

  // 昨日からのメッセージ
  const yesterdayMessage =
    yesterdayNight?.answers.messageToTomorrowSelf?.trim() ?? "";
  const yesterdayMeta = yesterdayNight
    ? formatYesterdayMeta(new Date(yesterdayNight.created_at), now)
    : "";
  // team review P1: ラベル「全文」に対応する遷移先は「閲覧」が自然なので、
  // 履歴の該当日にジャンプする。yesterdayHref が無いケースは /history トップ。
  const yesterdayHref = yesterdayNight
    ? `/history?year=${new Date(yesterdayNight.created_at)
        .toLocaleDateString("en-US", { timeZone: "Asia/Tokyo", year: "numeric" })
        }`
    : "/history";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-7 sm:py-10">
      {/* Header */}
      <header
        className="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3"
        style={{ borderBottom: "1px dashed var(--color-line)" }}
      >
        <div>
          <p className="sk-eyebrow">
            {dateMeta}
            {!isViewingToday && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 8px",
                  background: "var(--color-accent)",
                  color: "var(--color-bg)",
                  borderRadius: 10,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                }}
              >
                {todayKey === businessTomorrowKey ? "明日を計画中" : "別日を表示中"}
              </span>
            )}
          </p>
          <p className="sk-h mt-0.5">{greeting}</p>
          {/* Issue #46: 表示日セレクタ */}
          <div className="mt-2">
            <DateNavigator
              viewDate={todayKey}
              todayDate={businessTodayKey}
              tomorrowDate={businessTomorrowKey}
            />
          </div>
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

      {/* データ取得エラーがあればユーザーに通知 (サイレント空表示を避ける)。 */}
      {dataErrors.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="sk-card sk-card-dashed mb-4"
          style={{ padding: 12 }}
        >
          <p className="sk-mono" style={{ color: "var(--color-warn)" }}>
            ⚠️ データの読み込みに一部失敗しました。時間をおいて再読み込みしてください。
          </p>
        </div>
      )}

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
        todayLabel={todayLabelFormatter.format(businessNow)}
        weekRangeLabel={weekRangeLabel}
        weekRemainingLabel={`残り ${daysToWeekEnd}日`}
        monthLabel={monthLabel}
        monthRemainingLabel={`残り ${daysToMonthEnd}日`}
      />

      {/* ToDo カード。Issue #46: showCarryAction は「今日表示の evening」のみ
          (明日表示中に carry → "明日の翌日" は通常使わない)。 */}
      <TodoCard
        todos={todos}
        todayDate={todayKey}
        timeOfDay={timeOfDay}
        showCarryAction={isViewingToday && timeOfDay === "evening"}
        carryProposal={yesterdayPending}
      />
    </main>
  );
}
