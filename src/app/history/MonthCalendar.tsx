"use client";

import { useRef } from "react";
import type { FlowType } from "@/lib/flows";

type Props = {
  /** 表示する年月 */
  year: number;
  /** 1-12 */
  month: number;
  /** 選択中の日 (YYYY-MM-DD)、未選択なら null */
  selectedDate: string | null;
  /** 各日の記録 type セット */
  typesByDate: Map<string, Set<FlowType>>;
  /** 各日の実際の記録件数 (同日複数 morning など type 数とずれるため別途渡す) */
  countsByDate: Map<string, number>;
  /** 今日の JST 日付 (YYYY-MM-DD) */
  todayDate: string;
  /** 日付クリック時のコールバック */
  onSelectDate: (date: string) => void;
};

const WEEKDAY_HEADERS = ["月", "火", "水", "木", "金", "土", "日"];

type DayCellEntry = { day: number; dateKey: string };

export function MonthCalendar({
  year,
  month,
  selectedDate,
  typesByDate,
  countsByDate,
  todayDate,
  onSelectDate,
}: Props) {
  // その月の cells を組み立てる (月曜始まり)
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const dayOfWeek = firstOfMonth.getUTCDay(); // 0=Sun, 1=Mon
  const leadingBlanks = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  type Cell = { day: number | null; dateKey: string | null };
  const cells: Cell[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, dateKey: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateKey });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, dateKey: null });

  // roving tabindex 用: 当月の全日を配列にし、矢印キーで±1 / ±7 移動できるようにする。
  // (WAI-ARIA grid pattern + Codex review PR #33 で指摘あり)
  const days: DayCellEntry[] = cells.flatMap((c) =>
    c.day != null && c.dateKey != null ? [{ day: c.day, dateKey: c.dateKey }] : [],
  );

  // 行ごとに分割 (role="row" 直下に gridcell を入れる WAI-ARIA 構造)
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  // roving tabindex の基準日。選択中があればそれ、なければ今日 (当月) または 1 日。
  const focusableDate = (() => {
    if (selectedDate && days.some((d) => d.dateKey === selectedDate)) return selectedDate;
    if (days.some((d) => d.dateKey === todayDate)) return todayDate;
    return days[0]?.dateKey ?? null;
  })();

  const gridRef = useRef<HTMLDivElement>(null);

  function focusByDate(targetKey: string) {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(
      `button[data-datekey="${targetKey}"]`,
    );
    if (el) el.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, dateKey: string) {
    const idx = days.findIndex((d) => d.dateKey === dateKey);
    if (idx < 0) return;
    let nextIdx: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
        nextIdx = idx - 1;
        break;
      case "ArrowRight":
        nextIdx = idx + 1;
        break;
      case "ArrowUp":
        nextIdx = idx - 7;
        break;
      case "ArrowDown":
        nextIdx = idx + 7;
        break;
      case "Home":
        // 週頭 (月曜) に移動
        nextIdx = idx - (idx % 7);
        break;
      case "End":
        // 週末 (日曜) に移動
        nextIdx = idx + (6 - (idx % 7));
        break;
      default:
        return;
    }
    if (nextIdx == null) return;
    e.preventDefault();
    if (nextIdx < 0 || nextIdx >= days.length) return;
    const targetKey = days[nextIdx].dateKey;
    onSelectDate(targetKey);
    focusByDate(targetKey);
  }

  return (
    <div>
      <div
        role="row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          marginBottom: 6,
        }}
      >
        {WEEKDAY_HEADERS.map((h) => (
          <span
            key={h}
            role="columnheader"
            className="sk-mono"
            style={{ textAlign: "center", fontSize: 10 }}
          >
            {h}
          </span>
        ))}
      </div>
      <div
        ref={gridRef}
        role="grid"
        aria-label={`${year}年${month}月のカレンダー`}
        style={{ display: "grid", gap: 6 }}
      >
        {rows.map((row, rowIdx) => (
          <div
            key={`row-${rowIdx}`}
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
            }}
          >
            {row.map((c, colIdx) =>
              c.day == null || c.dateKey == null ? (
                // 月外の空 cell。role="gridcell" を残しつつ aria-hidden で SR の
                // ナビ対象から外す (グリッド構造の整合のため空ではあるが cell として残す)。
                <div
                  key={`blank-${rowIdx}-${colIdx}`}
                  role="gridcell"
                  aria-hidden
                  style={{ aspectRatio: "1" }}
                />
              ) : (
                <DayCell
                  key={c.dateKey}
                  day={c.day}
                  dateKey={c.dateKey}
                  isSelected={selectedDate === c.dateKey}
                  isToday={todayDate === c.dateKey}
                  isFocusable={c.dateKey === focusableDate}
                  types={typesByDate.get(c.dateKey) ?? new Set()}
                  recordCount={countsByDate.get(c.dateKey) ?? 0}
                  onSelect={onSelectDate}
                  onKeyDown={handleKeyDown}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({
  day,
  dateKey,
  isSelected,
  isToday,
  isFocusable,
  types,
  recordCount,
  onSelect,
  onKeyDown,
}: {
  day: number;
  dateKey: string;
  isSelected: boolean;
  isToday: boolean;
  isFocusable: boolean;
  types: Set<FlowType>;
  recordCount: number;
  onSelect: (date: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, dateKey: string) => void;
}) {
  // セル内に widget (button) が 1 つだけなので、WAI-ARIA 仕様で許される
  // 「focusable な button 自体に role="gridcell" を持たせる」パターンを採用。
  // テストが getByRole("gridcell", { name: ... }) で button を見つけられるよう、
  // aria-label をボタンに付与する。
  return (
    <button
      type="button"
      role="gridcell"
      data-datekey={dateKey}
      aria-selected={isSelected}
      aria-label={`${day}日${recordCount > 0 ? ` ・ ${recordCount}件の記録` : ""}${isToday ? " (今日)" : ""}`}
      tabIndex={isFocusable ? 0 : -1}
      onClick={() => onSelect(dateKey)}
      onKeyDown={(e) => onKeyDown(e, dateKey)}
      className="relative cursor-pointer text-left"
      style={{
        aspectRatio: "1",
        border: "1.2px solid var(--color-line-soft)",
        borderRadius: 10,
        background: isSelected ? "var(--color-ink)" : "var(--color-bg)",
        color: isSelected ? "var(--color-bg)" : "var(--color-ink)",
        padding: 6,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "var(--font-sans), sans-serif",
        fontSize: 14,
      }}
    >
        <span style={{ fontWeight: isToday ? 700 : 400, opacity: isSelected ? 1 : 0.9 }}>
          {day}
        </span>
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {Array.from(types).map((t) => (
            <span
              key={t}
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isSelected ? "var(--color-bg)" : dotColor(t),
              }}
            />
          ))}
        </div>
        {isToday && !isSelected && (
          <span
            aria-hidden
            className="sk-mono"
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "var(--color-accent)",
              color: "white",
              padding: "1px 5px",
              borderRadius: 6,
              fontSize: 8,
            }}
          >
            今日
          </span>
        )}
      </button>
  );
}

function dotColor(type: FlowType): string {
  switch (type) {
    case "morning":
      return "var(--color-warn)";
    case "night":
      return "var(--color-accent)";
    case "weeklyGoal":
    case "weeklyReview":
      return "var(--color-ink-2)";
    case "monthlyGoal":
    case "monthlyReview":
      return "var(--color-ink)";
  }
}

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <LegendDot color="var(--color-warn)" label="朝" />
      <LegendDot color="var(--color-accent)" label="夜" />
      <LegendDot color="var(--color-ink-2)" label="週目標/振返" />
      <LegendDot color="var(--color-ink)" label="月目標/振返" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="sk-mono inline-flex items-center gap-1">
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
