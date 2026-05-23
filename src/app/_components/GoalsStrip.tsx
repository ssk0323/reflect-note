import Link from "next/link";
import type { RecordRow } from "@/lib/records/types";
import { CheckableItem } from "./CheckableItem";

export type GoalStripData = {
  /** 今日の morning record (あれば) */
  today: RecordRow | null;
  /** 今週の weeklyGoal record (あれば) */
  week: RecordRow | null;
  /** 今月の monthlyGoal record (あれば) */
  month: RecordRow | null;
  /** 今日のラベル (例: "5/21(木)") */
  todayLabel: string;
  /** 今週の期間ラベル (例: "5/19 → 5/25 · 残り 3日") */
  weekRangeLabel: string;
  weekRemainingLabel: string;
  /** 今月のラベル (例: "5月" / "残り 10日") */
  monthLabel: string;
  monthRemainingLabel: string;
};

const STAR_KEYS = ["task1", "task2", "task3"] as const;
const WEEK_KEYS = ["weekPriority1", "weekPriority2", "weekPriority3"] as const;
const MONTH_KEYS = [
  "monthPriority1",
  "monthPriority2",
  "monthPriority3",
] as const;

/** 「今日 / 今週 / 今月」の目標と主要 3 タスクを並べた最上部ストリップ。
 *  Web: 3 カラム / Mobile: 今日フル幅 + 今週/今月 2 カラム圧縮。 */
export function GoalsStrip(props: GoalStripData) {
  return (
    <div
      className="grid gap-3 mb-5 lg:grid-cols-[1.05fr_1fr_1fr]"
      style={{ gridTemplateColumns: undefined }}
    >
      <TodayGoalCard
        record={props.today}
        label={props.todayLabel}
      />
      <div className="grid gap-3 grid-cols-2 lg:contents">
        <PeriodGoalCard
          eyebrow={`今週 · ${props.weekRangeLabel}`}
          remainder={props.weekRemainingLabel}
          record={props.week}
          taskKeys={WEEK_KEYS}
          labels={["優先 1", "優先 2", "優先 3"]}
          goalKey="weekGoal"
          editHref={
            props.week ? `/flows/weeklyGoal?edit=${props.week.id}` : "/flows/weeklyGoal"
          }
          emptyCta={{ href: "/flows/weeklyGoal", label: "今週の目標を立てる →" }}
        />
        <PeriodGoalCard
          eyebrow={`今月 · ${props.monthLabel}`}
          remainder={props.monthRemainingLabel}
          record={props.month}
          taskKeys={MONTH_KEYS}
          labels={["重点 1", "重点 2", "重点 3"]}
          goalKey="monthGoal"
          editHref={
            props.month ? `/flows/monthlyGoal?edit=${props.month.id}` : "/flows/monthlyGoal"
          }
          emptyCta={{ href: "/flows/monthlyGoal", label: "今月の目標を立てる →" }}
        />
      </div>
    </div>
  );
}

function TodayGoalCard({
  record,
  label,
}: {
  record: RecordRow | null;
  label: string;
}) {
  if (!record) {
    return (
      <article
        className="sk-card"
        aria-label="今日の目標"
        style={{
          borderColor: "var(--color-accent)",
          borderWidth: "1.5px",
          background: "var(--color-accent-soft)",
        }}
      >
        <div className="flex items-baseline gap-2">
          <span aria-hidden style={{ color: "var(--color-accent)" }}>
            ★
          </span>
          <span
            className="sk-eyebrow"
            style={{ color: "var(--color-accent)" }}
          >
            今日 {label}
          </span>
        </div>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--color-ink-2)" }}
        >
          今日の目標はまだ設定されていません。
        </p>
        <div className="mt-3">
          <Link href="/flows/morning" className="sk-btn sk-btn-ink">
            朝のセットアップを始める →
          </Link>
        </div>
      </article>
    );
  }

  const goal = record.answers.goal?.trim() ?? "";
  const attention = record.answers.attention?.trim() ?? "";
  const stars = STAR_KEYS.map((k) => ({
    key: k,
    text: record.answers[k]?.trim() ?? "",
    checked: record.checks[k] === true,
  })).filter((s) => s.text.length > 0);
  const doneCount = stars.filter((s) => s.checked).length;

  return (
    <article
      className="sk-card"
      aria-label="今日の目標"
      style={{
        borderColor: "var(--color-accent)",
        borderWidth: "1.5px",
        background: "var(--color-accent-soft)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span aria-hidden style={{ color: "var(--color-accent)" }}>
            ★
          </span>
          <span
            className="sk-eyebrow"
            style={{ color: "var(--color-accent)" }}
          >
            今日 {label}
          </span>
        </div>
        <span
          className="sk-mono"
          style={{ color: "var(--color-accent)" }}
          aria-label={`今日の大事な3つ ${doneCount} / ${stars.length} 達成`}
        >
          {doneCount} / {stars.length} ✓
        </span>
      </div>

      {goal && (
        <p
          className="mt-2"
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--color-ink)",
            lineHeight: 1.25,
            margin: 0,
          }}
        >
          {goal}
        </p>
      )}
      {attention && (
        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--color-ink-2)",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          〝{attention}〟
        </p>
      )}

      {stars.length > 0 && (
        <div
          className="mt-2 pt-2"
          style={{ borderTop: "1px dashed var(--color-accent)" }}
        >
          <p
            className="sk-eyebrow"
            style={{ color: "var(--color-accent)" }}
          >
            大事な 3 つ
          </p>
          <div className="mt-2 space-y-1">
            {stars.map((s) => (
              <CheckableItem
                key={s.key}
                recordId={record.id}
                fieldKey={s.key}
                text={s.text}
                initialChecked={s.checked}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Link
          href={`/flows/morning?edit=${record.id}`}
          className="sk-mono hover:text-[var(--color-ink)]"
          aria-label="今日の目標を編集する"
        >
          編集 ›
        </Link>
      </div>
    </article>
  );
}

function PeriodGoalCard({
  eyebrow,
  remainder,
  record,
  taskKeys,
  labels,
  goalKey,
  editHref,
  emptyCta,
}: {
  eyebrow: string;
  remainder: string;
  record: RecordRow | null;
  taskKeys: readonly string[];
  labels: readonly string[];
  goalKey: string;
  editHref: string;
  emptyCta: { href: string; label: string };
}) {
  if (!record) {
    return (
      <article className="sk-card">
        <div className="flex items-baseline justify-between">
          <span className="sk-eyebrow">{eyebrow}</span>
          <span className="sk-mono">{remainder}</span>
        </div>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--color-ink-2)" }}
        >
          未設定
        </p>
        <Link
          href={emptyCta.href}
          className="sk-mono mt-2 inline-block hover:text-[var(--color-ink)]"
        >
          {emptyCta.label}
        </Link>
      </article>
    );
  }

  const goal = record.answers[goalKey]?.trim() ?? "";
  const items = taskKeys
    .map((k, idx) => ({
      key: k,
      label: labels[idx] ?? "",
      text: record.answers[k]?.trim() ?? "",
      checked: record.checks[k] === true,
    }))
    .filter((i) => i.text.length > 0);
  const doneCount = items.filter((i) => i.checked).length;

  return (
    <article className="sk-card">
      <div className="flex items-baseline justify-between">
        <span className="sk-eyebrow">{eyebrow}</span>
        <span className="sk-mono">{remainder}</span>
      </div>
      {goal && (
        <p
          className="mt-2"
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--color-ink)",
            lineHeight: 1.2,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {goal}
        </p>
      )}
      {items.length > 0 && (
        <div
          className="mt-2 pt-2"
          style={{ borderTop: "1px dashed var(--color-line-soft)" }}
        >
          <div className="flex items-baseline justify-between mb-1">
            <span className="sk-eyebrow">主要タスク</span>
            <span className="sk-mono">
              {doneCount} / {items.length} ✓
            </span>
          </div>
          <div className="space-y-0.5">
            {items.map((i) => (
              <CheckableItem
                key={i.key}
                recordId={record.id}
                fieldKey={i.key}
                text={i.text}
                sublabel={i.label}
                initialChecked={i.checked}
              />
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <Link
          href={editHref}
          className="sk-mono hover:text-[var(--color-ink)]"
        >
          編集 ›
        </Link>
      </div>
    </article>
  );
}
