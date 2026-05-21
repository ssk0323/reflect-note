"use client";

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

  return (
    <div>
      <div
        role="presentation"
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
            className="sk-mono"
            style={{ textAlign: "center", fontSize: 10 }}
          >
            {h}
          </span>
        ))}
      </div>
      <div
        role="grid"
        aria-label={`${year}年${month}月のカレンダー`}
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}
      >
        {cells.map((c, i) =>
          c.day == null || c.dateKey == null ? (
            <div key={`blank-${i}`} aria-hidden style={{ aspectRatio: "1" }} />
          ) : (
            <DayCell
              key={c.dateKey}
              day={c.day}
              dateKey={c.dateKey}
              isSelected={selectedDate === c.dateKey}
              isToday={todayDate === c.dateKey}
              types={typesByDate.get(c.dateKey) ?? new Set()}
              recordCount={countsByDate.get(c.dateKey) ?? 0}
              onSelect={onSelectDate}
            />
          ),
        )}
      </div>
    </div>
  );
}

function DayCell({
  day,
  dateKey,
  isSelected,
  isToday,
  types,
  recordCount,
  onSelect,
}: {
  day: number;
  dateKey: string;
  isSelected: boolean;
  isToday: boolean;
  types: Set<FlowType>;
  recordCount: number;
  onSelect: (date: string) => void;
}) {
  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-label={`${day}日${recordCount > 0 ? ` ・ ${recordCount}件の記録` : ""}${isToday ? " (今日)" : ""}`}
      onClick={() => onSelect(dateKey)}
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
