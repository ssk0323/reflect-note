import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/lib/records/types";
import { HistoryClient } from "./HistoryClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

const TIME_ZONE = "Asia/Tokyo";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function todayJstParts(): { dateKey: string; year: number } {
  const dateKey = dateKeyFormatter.format(new Date());
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("records")
    .select("id, type, answers, checks, created_at, updated_at")
    .gte("created_at", yearStartUtc)
    .lt("created_at", yearEndUtc)
    .order("created_at", { ascending: false })
    .limit(3000); // 1 年 6 種類 × 365 = 2190 を上限の目安に少し余裕を持たせる

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
  return (
    <HistoryClient
      records={records}
      year={year}
      todayDate={todayDate}
      todayYear={todayYear}
    />
  );
}
