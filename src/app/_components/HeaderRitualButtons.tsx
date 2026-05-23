import Link from "next/link";

export type RitualKind = "morning" | "evening" | "weekReview" | "monthReview";

type RitualState = {
  kind: RitualKind;
  done: boolean;
  active: boolean;
  /** done=true のときの表示時刻 (HH:MM)。任意。 */
  doneTime?: string;
  /** クリック先のフロー */
  href: string;
};

const META: Record<
  RitualKind,
  { glyph: string; short: string; title: string }
> = {
  morning: { glyph: "☼", short: "朝", title: "朝のセットアップ" },
  evening: { glyph: "☾", short: "夜", title: "夜のリフレクション" },
  weekReview: { glyph: "週", short: "週", title: "週の振り返り" },
  monthReview: { glyph: "月", short: "月", title: "月の振り返り" },
};

export function HeaderRitualButtons({
  rituals,
  mobile = false,
}: {
  rituals: RitualState[];
  mobile?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="儀式ボタン"
      className="flex items-center gap-1.5 flex-wrap"
    >
      {rituals.map((r) => (
        <RitualButton key={r.kind} {...r} mobile={mobile} />
      ))}
    </div>
  );
}

function RitualButton({
  kind,
  done,
  active,
  doneTime,
  href,
  mobile,
}: RitualState & { mobile: boolean }) {
  const meta = META[kind];

  return (
    <Link
      href={href}
      aria-label={`${meta.title}${active ? "・今やる時間です" : done ? "・完了済" : ""}`}
      className="relative inline-flex items-center gap-1.5"
      style={{
        padding: mobile ? "4px 8px" : "5px 10px",
        background: active
          ? "var(--color-accent-soft)"
          : done
            ? "var(--color-bg-2)"
            : "var(--color-bg)",
        border: `1.4px solid ${active ? "var(--color-accent)" : "var(--color-line)"}`,
        borderRadius: "10px 13px 9px 12px / 10px 9px 13px 10px",
        fontFamily: "var(--font-sans), sans-serif",
        fontSize: mobile ? 13 : 14,
        color: "var(--color-ink)",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          color: active
            ? "var(--color-accent)"
            : done
              ? "var(--color-ink-3)"
              : "var(--color-ink-2)",
          fontSize: mobile ? 14 : 16,
          lineHeight: 1,
        }}
      >
        {meta.glyph}
      </span>
      {!mobile && (
        <span
          style={{
            fontWeight: 700,
            color: active
              ? "var(--color-accent)"
              : done
                ? "var(--color-ink-3)"
                : "var(--color-ink-2)",
            lineHeight: 1,
          }}
        >
          {meta.short}
        </span>
      )}
      <span
        className="sk-mono"
        style={{
          color: active ? "var(--color-accent)" : "var(--color-ink-3)",
          fontSize: mobile ? 9 : 10,
        }}
      >
        {done ? `✓${!mobile && doneTime ? ` ${doneTime}` : ""}` : "→"}
      </span>
      {active && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--color-accent)",
            border: "1.5px solid var(--color-bg)",
          }}
        />
      )}
    </Link>
  );
}
