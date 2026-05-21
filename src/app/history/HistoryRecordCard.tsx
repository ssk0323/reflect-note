"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { definedFlows, type Flow, type FlowType } from "@/lib/flows";
import { formatJstTime } from "@/lib/records/group";
import type { RecordRow } from "@/lib/records/types";
import { deleteRecord } from "./actions";

const TYPE_CHIP_STYLE: Record<FlowType, { label: string; color: string }> = {
  morning: { label: "朝", color: "var(--color-warn)" },
  night: { label: "夜", color: "var(--color-accent)" },
  weeklyGoal: { label: "週目標", color: "var(--color-ink-2)" },
  weeklyReview: { label: "週振返", color: "var(--color-ink-2)" },
  monthlyGoal: { label: "月目標", color: "var(--color-ink)" },
  monthlyReview: { label: "月振返", color: "var(--color-ink)" },
};

export function HistoryRecordCard({ record }: { record: RecordRow }) {
  const flow = definedFlows[record.type];
  const chip = TYPE_CHIP_STYLE[record.type];
  const preview = useMemo(() => firstAnswerOf(flow, record), [flow, record]);

  return (
    <article className="sk-card sk-card-ghost" style={{ padding: 14 }}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="sk-chip"
            style={{ color: chip.color, borderColor: chip.color }}
          >
            {chip.label}
          </span>
          <span className="sk-mono">{formatJstTime(record.created_at)}</span>
        </div>
      </div>

      <p
        className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6"
        style={{ color: "var(--color-ink)" }}
      >
        {preview}
      </p>

      <details className="mt-2">
        <summary className="sk-mono cursor-pointer">▾ 展開して全文を見る</summary>
        <div
          className="mt-2 space-y-3 pt-3"
          style={{ borderTop: "1px dashed var(--color-line-soft)" }}
        >
          <RecordAnswers flow={flow} answers={record.answers} />
        </div>
      </details>

      <div className="mt-3 flex gap-2">
        <Link
          href={`/flows/${record.type}?edit=${record.id}`}
          className="sk-btn sk-btn-ghost"
          style={{ fontSize: 13, padding: "6px 12px" }}
        >
          編集する
        </Link>
        <DeleteButton recordId={record.id} />
      </div>
    </article>
  );
}

function firstAnswerOf(flow: Flow, record: RecordRow): string {
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
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label="この記録を削除"
        className="sk-btn sk-btn-ghost"
        style={{ fontSize: 13, padding: "6px 12px" }}
      >
        {isPending ? "削除中..." : "削除"}
      </button>
      {error && (
        <p role="alert" className="sk-mono" style={{ color: "var(--color-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function RecordAnswers({ flow, answers }: { flow: Flow; answers: RecordRow["answers"] }) {
  return (
    <>
      {flow.questions.map((q) => (
        <div key={q.key}>
          <p className="sk-eyebrow">{q.title}</p>
          {q.kind === "group" ? (
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {q.fields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-xl p-2"
                  style={{ background: "var(--color-bg-2)" }}
                >
                  <p className="sk-eyebrow">{field.label}</p>
                  <p
                    className="mt-1 whitespace-pre-wrap text-sm leading-6"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {answers[field.key]?.trim() || "未入力"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p
              className="mt-1 whitespace-pre-wrap text-sm leading-6"
              style={{ color: "var(--color-ink)" }}
            >
              {answers[q.key]?.trim() || "未入力"}
            </p>
          )}
        </div>
      ))}
    </>
  );
}
