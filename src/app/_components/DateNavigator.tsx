"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  /** 現在表示している日 (YYYY-MM-DD) */
  viewDate: string;
  /** business day 基準の今日 (YYYY-MM-DD) */
  todayDate: string;
  /** business day 基準の明日 (YYYY-MM-DD) */
  tomorrowDate: string;
};

/** Issue #46: Home の「表示中の日付」セレクタ。
 *  今日 / 明日 / カレンダー で表示日を切り替える。
 *  選択で `/?date=YYYY-MM-DD` に navigate (今日選択時は `/`)。 */
export function DateNavigator({ viewDate, todayDate, tomorrowDate }: Props) {
  const router = useRouter();
  const isToday = viewDate === todayDate;
  const isTomorrow = viewDate === tomorrowDate;
  const isOther = !isToday && !isTomorrow;

  function handlePick(raw: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
    if (raw === todayDate) {
      router.push("/");
    } else {
      router.push(`/?date=${raw}`);
    }
  }

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      aria-label="表示する日付の切り替え"
    >
      <Link
        href="/"
        aria-current={isToday ? "page" : undefined}
        className="sk-chip"
        style={{
          background: isToday ? "var(--color-ink)" : "var(--color-bg)",
          color: isToday ? "var(--color-bg)" : "var(--color-ink-3)",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        今日
      </Link>
      <Link
        href={`/?date=${tomorrowDate}`}
        aria-current={isTomorrow ? "page" : undefined}
        className="sk-chip"
        style={{
          background: isTomorrow ? "var(--color-ink)" : "var(--color-bg)",
          color: isTomorrow ? "var(--color-bg)" : "var(--color-ink-3)",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        明日
      </Link>
      <label
        className="sk-chip flex items-center gap-1"
        style={{
          background: isOther ? "var(--color-ink)" : "var(--color-bg)",
          color: isOther ? "var(--color-bg)" : "var(--color-ink-3)",
        }}
      >
        <span className="sr-only">表示する日付を選ぶ</span>
        <input
          type="date"
          value={isOther ? viewDate : ""}
          onChange={(e) => handlePick(e.target.value)}
          aria-label="日付を選んで表示"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            color: "inherit",
            cursor: "pointer",
          }}
        />
      </label>
    </div>
  );
}
