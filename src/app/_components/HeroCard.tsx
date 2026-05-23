import Link from "next/link";
import type { Flow } from "@/lib/flows";
import type { RecordRow } from "@/lib/records/types";
import { CheckableItem } from "./CheckableItem";
import type { CheckableField } from "./GoalCard";

export type HeroMode = "morning" | "night" | "done";

type Props = {
  mode: HeroMode;
  // 「今日の進捗」mini で表示する今日の morning record (あれば)
  todayRecord: RecordRow | null;
  morningCheckables: CheckableField[];
  // 「他を書く」チップで使う、6 フローの label
  flowLabels: Record<Flow["type"], string>;
};

const COPY: Record<HeroMode, {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}> = {
  morning: {
    eyebrow: "朝のセットアップ · 一日の始まりに",
    title: <>今日の輪郭を、<br />ひと筆で描く。</>,
    body: "5 つの問いに、書きたい分だけ。3 分でも、15 分でも。",
    primary: { label: "朝のセットアップを始める →", href: "/flows/morning" },
  },
  night: {
    eyebrow: "夜のリフレクション · 一日の終わりに",
    title: <>今日を、<br />ひと呼吸して振り返る。</>,
    body: "7 つの問いに、書きたい分だけ。3 分でも、15 分でも。",
    primary: { label: "夜のリフレクションを始める →", href: "/flows/night" },
  },
  done: {
    eyebrow: "今日の記録は揃いました",
    title: <>今日はおつかれさま。<br />明日に向けて、ひと呼吸。</>,
    body: "朝・夜どちらも記録済みです。週・月の振り返りに進むか、今日の記録を見直すこともできます。",
    primary: { label: "週の目標を見る →", href: "/flows/weeklyGoal" },
    secondary: { label: "今日の記録を見直す", href: "/flows/morning" },
  },
};

const ALT_FLOW_ORDER: Flow["type"][] = [
  "morning",
  "night",
  "weeklyGoal",
  "weeklyReview",
  "monthlyGoal",
  "monthlyReview",
];

export function HeroCard({
  mode,
  todayRecord,
  morningCheckables,
  flowLabels,
}: Props) {
  const copy = COPY[mode];
  const visibleToday = todayRecord
    ? morningCheckables
        .map((f) => ({
          key: f.key,
          label: f.label,
          text: todayRecord.answers[f.key]?.trim() ?? "",
        }))
        .filter((item) => item.text.length > 0)
    : [];
  const checkedToday = todayRecord
    ? visibleToday.filter((i) => todayRecord.checks[i.key] === true).length
    : 0;

  return (
    <article className="sk-card-lg p-7 sm:p-8" aria-label="今日のフォーカス">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="sk-eyebrow">{copy.eyebrow}</p>
          <h1 className="sk-h-xl mt-1">{copy.title}</h1>
          <p
            className="mt-3 max-w-prose text-base leading-relaxed"
            style={{ color: "var(--color-ink-2)" }}
          >
            {copy.body}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={copy.primary.href} className="sk-btn sk-btn-ink">
              {copy.primary.label}
            </Link>
            {copy.secondary && (
              <Link href={copy.secondary.href} className="sk-btn sk-btn-ghost">
                {copy.secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div
        className="mt-6 pt-5"
        style={{ borderTop: "1px dashed var(--color-line-soft)" }}
      >
        <p className="sk-eyebrow mb-2">他を書く（提案が合わなければ）</p>
        <div className="flex flex-wrap gap-1.5">
          {ALT_FLOW_ORDER.map((type) => (
            <Link key={type} href={`/flows/${type}`} className="sk-chip">
              {flowLabels[type]}
            </Link>
          ))}
        </div>
      </div>

      {todayRecord && visibleToday.length > 0 && (
        <div
          className="mt-5 pt-5"
          style={{ borderTop: "1px dashed var(--color-line-soft)" }}
        >
          <div className="flex items-baseline justify-between">
            <p className="sk-eyebrow">今日の目標 · 朝に書いた</p>
            <Link
              href={`/flows/morning?edit=${todayRecord.id}`}
              aria-label="今日の目標を編集する"
              className="sk-mono hover:text-[var(--color-ink)]"
            >
              {checkedToday} / {visibleToday.length} 達成 · 編集 ›
            </Link>
          </div>
          <div className="mt-2 space-y-1">
            {visibleToday.map((item) => (
              <CheckableItem
                key={item.key}
                recordId={todayRecord.id}
                fieldKey={item.key}
                text={item.text}
                sublabel={item.label}
                initialChecked={todayRecord.checks[item.key] === true}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
