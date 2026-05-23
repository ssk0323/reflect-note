"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Flow, FlowAnswers, Question } from "@/lib/flows";
import { normalizeTargetDate } from "@/lib/records/targetDate";
import { updateFlowRecord } from "./actions";
import { FlowDateChips } from "./FlowDateChips";

type Props = {
  flow: Flow;
  recordId: string;
  initialAnswers: FlowAnswers;
  /** 既存レコードの target_date (NULL なら旧データ → initialFallbackDate を使う) */
  initialTargetDate: string | null;
  /** target_date が NULL の旧データを編集するときの初期値 (= created_at の JST 日付、
   *  週/月フローでは正規化済み)。ユーザーが明示的に変更しない限り保存時に日付が
   *  書き換わらないようにするため、サーバ側で計算して渡す。 */
  initialFallbackDate: string;
};

export function EditClient({
  flow,
  recordId,
  initialAnswers,
  initialTargetDate,
  initialFallbackDate,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<FlowAnswers>(initialAnswers);
  // 旧データ (target_date NULL) はフォールバック日付 (= created_at の JST 日付を
  // 週/月で正規化したもの) を初期値にする。ユーザーが chip 等で変更しない限り、
  // 保存時に target_date が書き換わらない動作を保証する。
  const [targetDate, setTargetDate] = useState<string>(
    () => initialTargetDate ?? normalizeTargetDate(flow.type, initialFallbackDate),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateFlowRecord(recordId, answers, targetDate);
        if (result.ok) {
          router.push("/history");
        } else {
          setError(result.error ?? "保存に失敗しました");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {flow.label} を編集
        </span>
        <span className="text-xs text-zinc-500">
          直したい項目だけ書き換えて保存できます。
        </span>
      </header>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6">
          <FlowDateChips
            type={flow.type}
            value={targetDate}
            onChange={setTargetDate}
          />
        </div>

        <div className="space-y-8">
          {flow.questions.map((q) => (
            <QuestionField
              key={q.key}
              question={q}
              answers={answers}
              onChange={updateAnswer}
            />
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/history"
            className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-center text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            キャンセル
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "保存中..." : "保存する"}
          </button>
        </div>
      </section>
    </main>
  );
}

function QuestionField({
  question,
  answers,
  onChange,
}: {
  question: Question;
  answers: FlowAnswers;
  onChange: (key: string, value: string) => void;
}) {
  if (question.kind === "group") {
    return (
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {question.title}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {question.helper}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {question.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {field.label}
              </span>
              <textarea
                value={answers[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="min-h-24 w-full resize-none rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={question.key}>
        <span className="block text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {question.title}
        </span>
        <span className="mt-2 block text-sm text-zinc-600 dark:text-zinc-400">
          {question.helper}
        </span>
      </label>
      <div className="mt-3">
        {question.kind === "textarea" ? (
          <textarea
            id={question.key}
            value={answers[question.key] ?? ""}
            onChange={(e) => onChange(question.key, e.target.value)}
            placeholder={question.placeholder}
            className="min-h-28 w-full resize-none rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base leading-7 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        ) : (
          <input
            id={question.key}
            type="text"
            value={answers[question.key] ?? ""}
            onChange={(e) => onChange(question.key, e.target.value)}
            placeholder={question.placeholder}
            className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        )}
      </div>
    </div>
  );
}
