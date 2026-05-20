"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { definedFlows, type Flow, type FlowType } from "@/lib/flows";
import {
  formatDate,
  formatDateTime,
  groupRecordsByDate,
} from "@/lib/records/group";
import type { RecordRow } from "@/lib/records/types";
import { deleteRecord } from "./actions";

type Props = {
  records: RecordRow[];
};

type Filter = "all" | FlowType;

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "morning", label: "朝" },
  { value: "night", label: "夜" },
  { value: "weeklyGoal", label: "週目標" },
  { value: "weeklyReview", label: "週振り返り" },
  { value: "monthlyGoal", label: "月目標" },
  { value: "monthlyReview", label: "月振り返り" },
];

export function HistoryClient({ records }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filteredRecords = useMemo(
    () =>
      filter === "all" ? records : records.filter((r) => r.type === filter),
    [records, filter],
  );

  const groups = useMemo(
    () => groupRecordsByDate(filteredRecords),
    [filteredRecords],
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-500">過去の記録</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            これまでに書いたもの
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            記録は新しい順に並びます。
          </p>
        </div>
        <FilterTabs current={filter} onChange={setFilter} />
      </header>

      {filteredRecords.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section
              key={group.dateKey}
              aria-label={formatDate(group.records[0].created_at)}
            >
              <h2 className="mb-3 text-sm font-bold text-zinc-500">
                {formatDate(group.records[0].created_at)}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {group.records.map((record) => (
                  <RecordCard key={record.id} record={record} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function FilterTabs({
  current,
  onChange,
}: {
  current: Filter;
  onChange: (next: Filter) => void;
}) {
  // ARIA tabs パターンは roving tabIndex / 矢印キー操作 / aria-controls
  // 等の実装が必要で、現状は提供できないため、シンプルなトグルボタン
  // セット (aria-pressed) で表現する。
  return (
    <div
      role="group"
      aria-label="種別フィルタ"
      className="flex flex-wrap gap-1 rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      {FILTER_OPTIONS.map((opt) => {
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  if (filter === "all") {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          まだ記録がありません。トップから朝のセットアップを始めましょう。
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        この種別の記録はまだありません。
      </p>
    </div>
  );
}

function RecordCard({ record }: { record: RecordRow }) {
  const flow = definedFlows[record.type];
  const firstAnswer = useMemo(() => {
    for (const q of flow.questions) {
      if (q.kind === "group") {
        for (const field of q.fields) {
          const v = record.answers[field.key]?.trim();
          if (v) return v;
        }
      } else {
        const v = record.answers[q.key]?.trim();
        if (v) return v;
      }
    }
    return "未入力の記録です";
  }, [flow, record]);

  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {flow.shortLabel}
          </span>
          <h3 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {flow.label}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {formatDateTime(record.created_at)}
          </p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 min-h-[4.5rem] whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {firstAnswer}
      </p>

      <details className="mt-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          内容を見る
        </summary>
        <div className="mt-4 space-y-3">
          <RecordAnswers flow={flow} answers={record.answers} />
        </div>
      </details>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/flows/${record.type}?edit=${record.id}`}
          className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          編集する
        </Link>
        <DeleteButton recordId={record.id} />
      </div>
    </article>
  );
}

function DeleteButton({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm("この記録を削除しますか？")) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteRecord(recordId);
        if (result.ok) {
          router.refresh();
        } else {
          setError(result.error ?? "削除に失敗しました");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label="この記録を削除"
        className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {isPending ? "削除中..." : "削除"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function RecordAnswers({
  flow,
  answers,
}: {
  flow: Flow;
  answers: RecordRow["answers"];
}) {
  return (
    <>
      {flow.questions.map((q) => (
        <div key={q.key}>
          <p className="text-xs font-semibold text-zinc-500">{q.title}</p>
          {q.kind === "group" ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {q.fields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-xl bg-white p-3 dark:bg-zinc-950"
                >
                  <p className="text-xs font-bold text-zinc-500">
                    {field.label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-900 dark:text-zinc-100">
                    {answers[field.key]?.trim() || "未入力"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-900 dark:text-zinc-100">
              {answers[q.key]?.trim() || "未入力"}
            </p>
          )}
        </div>
      ))}
    </>
  );
}
