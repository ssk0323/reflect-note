import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toJstDateKey } from "@/lib/records/group";
import type { RecordRow } from "@/lib/records/types";
import { HistoryClient } from "./HistoryClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

function todayJstParts(): { dateKey: string; year: number } {
  // JST 日付キー生成は @/lib/records/group#toJstDateKey に集約済み。
  // ここで Intl.DateTimeFormat を再定義しない (Copilot review PR #33 で指摘あり)。
  const dateKey = toJstDateKey(new Date());
  const year = Number(dateKey.slice(0, 4));
  return { dateKey, year };
}

function parseYear(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return fallback;
  return n;
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const { year: yearParam } = await searchParams;
  const { dateKey: todayDate, year: todayYear } = todayJstParts();
  const year = parseYear(yearParam, todayYear);

  // その年の JST 範囲を UTC 境界として渡す。
  // 年初: JST YYYY-01-01 00:00 = UTC (YYYY-1)-12-31 15:00
  // 年末 exclusive: JST (YYYY+1)-01-01 00:00 = UTC YYYY-12-31 15:00
  const yearStartUtc = new Date(
    Date.UTC(year, 0, 1) - 9 * 60 * 60 * 1000,
  ).toISOString();
  const yearEndUtc = new Date(
    Date.UTC(year + 1, 0, 1) - 9 * 60 * 60 * 1000,
  ).toISOString();
  // target_date は date 型なので YYYY-MM-DD で比較する。
  const yearStartDate = `${year}-01-01`;
  const yearEndDate = `${year + 1}-01-01`;

  const supabase = await createSupabaseServerClient();
  // target_date が設定されたレコードは target_date がその年内、
  // NULL の旧レコードは created_at がその年内 (JST 換算した UTC 境界) を採用。
  // .or() 構文の値は PostgREST の特殊文字 (`,()`) や `.` `:` を含むためダブルクォート
  // で囲む (PR #31 review より)。
  const HISTORY_LIMIT = 3000;
  const { data, error } = await supabase
    .from("records")
    .select("id, type, answers, checks, target_date, created_at, updated_at")
    .or(
      `and(target_date.gte.${yearStartDate},target_date.lt.${yearEndDate}),` +
        `and(target_date.is.null,created_at.gte."${yearStartUtc}",created_at.lt."${yearEndUtc}")`,
    )
    .order("target_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT); // 1 年 6 種類 × 365 = 2190 を目安。上限到達は truncated フラグで検知

  if (error) {
    // 詳細はサーバーログにのみ出す。ユーザー画面には SQL や RLS 等の
    // 内部情報を漏らさない汎用メッセージを返す。
    console.error("Failed to fetch records", error);
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-12">
        <h1 className="sk-h-lg">過去の記録を取得できませんでした</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--color-ink-2)" }}>
          時間をおいてもう一度お試しください。問題が続く場合は管理者に連絡してください。
        </p>
      </main>
    );
  }

  const records = (data ?? []) as RecordRow[];
  // .limit に到達したか = データの切り捨てが起きたかを検知。
  // 起きた場合は UI 上で「一部のみ表示」のバナーを出し、データ欠落に気づけるようにする
  // (Copilot review PR #33 でサイレント欠落の指摘あり)。
  const truncated = records.length >= HISTORY_LIMIT;
  // year が変わったら HistoryClient を再マウントして calendarMonth /
  // selectedDate の初期値を新しい props で再評価させる (Codex/Copilot review
  // PR #33 で指摘あり: useState 初期化子は初回しか走らないため year ナビ後に
  // state が前年の値を引きずる)。
  return (
    <HistoryClient
      key={year}
      records={records}
      year={year}
      todayDate={todayDate}
      todayYear={todayYear}
      truncated={truncated}
    />
  );
}
