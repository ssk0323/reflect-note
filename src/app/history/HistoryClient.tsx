"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FlowType } from "@/lib/flows";
import {
  formatJstDateWithWeekday,
  formatJstMonth,
  groupRecordsByDate,
} from "@/lib/records/group";
import {
  countByDate,
  countByType,
  longestConsecutiveDays,
  typesByDate,
  type TypeCounts,
} from "@/lib/records/historyAggregates";
import type { RecordRow } from "@/lib/records/types";
import { HistoryRecordCard } from "./HistoryRecordCard";
import { MonthCalendar, CalendarLegend } from "./MonthCalendar";
import { YearHeatmap, HeatmapLegend } from "./YearHeatmap";

type Props = {
  /** 表示する年の全レコード (新しい順) */
  records: RecordRow[];
  /** 表示中の年 (URL ?year= で指定) */
  year: number;
  /** 今日の JST 日付 (YYYY-MM-DD) と JST 年 */
  todayDate: string;
  todayYear: number;
};

type Filter = "all" | FlowType;
type ViewMode = "calendar" | "list";

const FILTER_OPTIONS: { value: Filter; label: string; key: keyof TypeCounts }[] = [
  { value: "all", label: "すべて", key: "all" },
  { value: "morning", label: "朝", key: "morning" },
  { value: "night", label: "夜", key: "night" },
  { value: "weeklyGoal", label: "週目標", key: "weeklyGoal" },
  { value: "weeklyReview", label: "週振返", key: "weeklyReview" },
  { value: "monthlyGoal", label: "月目標", key: "monthlyGoal" },
  { value: "monthlyReview", label: "月振返", key: "monthlyReview" },
];

export function HistoryClient({ records, year, todayDate, todayYear }: Props) {
  const counts = useMemo(() => countByType(records), [records]);
  const dateCounts = useMemo(() => countByDate(records), [records]);
  const dateTypes = useMemo(() => typesByDate(records), [records]);
  const longest = useMemo(
    () => longestConsecutiveDays(dateCounts.keys()),
    [dateCounts],
  );

  const [filter, setFilter] = useState<Filter>("all");
  // ビューは常に Calendar デフォルト。viewport ベースの自動切替は SSR→CSR で
  // Calendar→List の Layout Shift (CLS) を生むため廃止し、ユーザーが明示的に
  // トグルする運用にした (team review PR #33 P0 指摘)。
  // モバイルでも Calendar は機能するが、List の方が読みやすい人はトグルで切替。
  const [view, setView] = useState<ViewMode>("calendar");

  // Calendar ビュー: 表示中の月 (1-12)。今年なら今月、過去/未来年なら 1 月。
  const initialMonth = year === todayYear ? Number(todayDate.split("-")[1]) : 1;
  const [calendarMonth, setCalendarMonth] = useState<number>(initialMonth);

  // Calendar ビュー: 選択中の日付。今年なら今日、それ以外は null。
  const [selectedDate, setSelectedDate] = useState<string | null>(
    year === todayYear ? todayDate : null,
  );

  const filteredRecords = useMemo(
    () =>
      filter === "all" ? records : records.filter((r) => r.type === filter),
    [records, filter],
  );

  const groups = useMemo(
    () => groupRecordsByDate(filteredRecords),
    [filteredRecords],
  );

  const selectedDayRecords = useMemo(() => {
    if (!selectedDate) return [];
    const group = groups.find((g) => g.dateKey === selectedDate);
    return group?.records ?? [];
  }, [groups, selectedDate]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-7 sm:py-12">
      <nav aria-label="ページ移動" className="mb-4">
        <Link
          href="/"
          className="sk-mono inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
        >
          <span aria-hidden>←</span> ホームへ戻る
        </Link>
      </nav>

      <header
        className="mb-6 flex flex-wrap items-end justify-between gap-3 pb-4"
        style={{ borderBottom: "1px dashed var(--color-line)" }}
      >
        <div>
          <p className="sk-eyebrow">これまでの記録</p>
          <h1 className="sk-h-lg mt-1">{year}年の足跡</h1>
          <p className="sk-mono mt-1">
            記録 {counts.all}件 · 朝 {counts.morning} / 夜 {counts.night} / 週{" "}
            {counts.weeklyGoal + counts.weeklyReview} / 月{" "}
            {counts.monthlyGoal + counts.monthlyReview}
          </p>
        </div>
        <YearNav current={year} todayYear={todayYear} />
      </header>

      {/* 年間ヒートマップ */}
      <section
        aria-label="年間ヒートマップ"
        className="sk-card sk-card-ghost mb-6"
        style={{ padding: 18 }}
      >
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <span className="sk-eyebrow">年間ヒートマップ</span>
          <HeatmapLegend />
        </div>
        <YearHeatmap year={year} countsByDate={dateCounts} />
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <span className="sk-mono">1月 ─ 12月（左→右で経過）</span>
          <span className="sk-mono">最長連続 {longest}日</span>
        </div>
      </section>

      {/* フィルタ + ビュー切替 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips counts={counts} current={filter} onChange={setFilter} />
        <ViewToggle current={view} onChange={setView} />
      </div>

      {counts.all === 0 ? (
        <EmptyState filter={filter} />
      ) : view === "calendar" ? (
        <CalendarView
          year={year}
          month={calendarMonth}
          onChangeMonth={setCalendarMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          typesByDate={dateTypes}
          countsByDate={dateCounts}
          selectedDayRecords={selectedDayRecords.filter((r) =>
            filter === "all" ? true : r.type === filter,
          )}
          todayDate={todayDate}
        />
      ) : (
        <ListView groups={groups} filter={filter} />
      )}
    </main>
  );
}

function YearNav({ current, todayYear }: { current: number; todayYear: number }) {
  // 翌年の chip は今年より未来の年に対しては表示するが、データはない想定なので
  // "今年" の chip を中央に置き、前後 1 年を移動できるようにする。
  const prev = current - 1;
  const next = current + 1;
  return (
    <nav aria-label="年切替" className="flex flex-wrap items-center gap-1.5">
      <Link href={`/history?year=${prev}`} className="sk-chip">
        ‹ {prev}
      </Link>
      <span
        className="sk-chip sk-chip-ink"
        aria-current="page"
      >
        {current}
      </span>
      {next <= todayYear + 1 && (
        <Link href={`/history?year=${next}`} className="sk-chip">
          {next} ›
        </Link>
      )}
    </nav>
  );
}

function FilterChips({
  counts,
  current,
  onChange,
}: {
  counts: TypeCounts;
  current: Filter;
  onChange: (next: Filter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="種別フィルタ"
      className="flex flex-wrap gap-1.5"
    >
      {FILTER_OPTIONS.map((opt) => {
        const count = counts[opt.key];
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={`sk-chip ${isActive ? "sk-chip-ink" : ""}`}
          >
            {opt.label} {count}
          </button>
        );
      })}
    </div>
  );
}

function ViewToggle({
  current,
  onChange,
}: {
  current: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  return (
    <div role="group" aria-label="ビュー切替" className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange("calendar")}
        aria-pressed={current === "calendar"}
        className={`sk-btn ${current === "calendar" ? "sk-btn-ink" : "sk-btn-ghost"}`}
        style={{ fontSize: 13, padding: "6px 12px" }}
      >
        📅 カレンダー
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={current === "list"}
        className={`sk-btn ${current === "list" ? "sk-btn-ink" : "sk-btn-ghost"}`}
        style={{ fontSize: 13, padding: "6px 12px" }}
      >
        📜 リスト
      </button>
    </div>
  );
}

function CalendarView({
  year,
  month,
  onChangeMonth,
  selectedDate,
  onSelectDate,
  typesByDate,
  countsByDate,
  selectedDayRecords,
  todayDate,
}: {
  year: number;
  month: number;
  onChangeMonth: (next: number) => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  typesByDate: Map<string, Set<FlowType>>;
  countsByDate: Map<string, number>;
  selectedDayRecords: RecordRow[];
  todayDate: string;
}) {
  const monthLabel = formatJstMonth(
    new Date(Date.UTC(year, month - 1, 1) - 9 * 60 * 60 * 1000),
  );

  function changeMonth(delta: number) {
    const next = month + delta;
    if (next < 1 || next > 12) return; // 年またぎは year nav で
    onChangeMonth(next);
  }

  return (
    <div
      role="region"
      aria-label="カレンダービュー"
      className="grid gap-6 lg:grid-cols-[1fr_360px]"
    >
      <section
        aria-label="月カレンダー"
        className="sk-card sk-card-ghost"
        style={{ padding: 20 }}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="sk-eyebrow">{monthLabel}</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={month === 1}
              className="sk-chip disabled:opacity-40"
            >
              ‹ {month === 1 ? "12月" : `${month - 1}月`}
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={month === 12}
              className="sk-chip disabled:opacity-40"
            >
              {month === 12 ? "1月" : `${month + 1}月`} ›
            </button>
          </div>
        </div>
        <MonthCalendar
          year={year}
          month={month}
          selectedDate={selectedDate}
          typesByDate={typesByDate}
          countsByDate={countsByDate}
          todayDate={todayDate}
          onSelectDate={onSelectDate}
        />
        <div className="mt-3">
          <CalendarLegend />
        </div>
      </section>

      <section aria-label="選択日の記録">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div>
            <p className="sk-eyebrow">選択中の日</p>
            <h2 className="sk-h mt-1" style={{ fontSize: 20 }}>
              {selectedDate ? formatDateKey(selectedDate) : "日付を選んでください"}
            </h2>
          </div>
        </div>

        {selectedDate && selectedDayRecords.length > 0 ? (
          <div className="flex flex-col gap-2">
            {selectedDayRecords.map((record) => (
              <HistoryRecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <div
            className="sk-card sk-card-dashed"
            style={{ padding: 14, textAlign: "center" }}
          >
            <span className="sk-eyebrow">
              {selectedDate
                ? // フィルタ適用で「その日自体は記録があるが今のフィルタには
                  // 該当しない」場合と「そもそも記録が無い日」を区別する
                  // (Copilot review PR #33 で指摘あり)。
                  (countsByDate.get(selectedDate) ?? 0) > 0
                  ? "この種別の記録はこの日にはありません"
                  : "この日の記録はまだありません"
                : "左のカレンダーから日付を選んでください"}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function ListView({
  groups,
  filter,
}: {
  groups: ReturnType<typeof groupRecordsByDate>;
  filter: Filter;
}) {
  if (groups.length === 0) {
    return <EmptyState filter={filter} />;
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey} aria-label={formatDateKey(group.dateKey)}>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="sk-eyebrow">{formatDateKey(group.dateKey)}</p>
            <span className="sk-mono">{group.records.length}件</span>
          </div>
          <div className="flex flex-col gap-2">
            {group.records.map((record) => (
              <HistoryRecordCard key={record.id} record={record} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  return (
    <div
      className="sk-card sk-card-dashed"
      style={{ padding: 40, textAlign: "center" }}
    >
      <p className="text-sm leading-6" style={{ color: "var(--color-ink-2)" }}>
        {filter === "all"
          ? "まだ記録がありません。ホームから朝のセットアップを始めましょう。"
          : "この種別の記録はまだありません。"}
      </p>
    </div>
  );
}

/** YYYY-MM-DD の JST 日付キーを「2026年5月21日(木)」形式に整形する。
 *  キーから JST 正午相当の UTC を作って formatJstDateWithWeekday に渡せば、
 *  既存ヘルパーで一貫した表記が得られる。 */
function formatDateKey(dateKey: string): string {
  // 12:00 JST = 03:00 UTC 相当の Date を作り、formatter に渡す。
  // 時刻は表示に出ないが UTC 起点で日付がずれないよう JST 正午を選ぶ。
  return formatJstDateWithWeekday(`${dateKey}T12:00:00+09:00`);
}
