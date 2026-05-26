"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Flow, FlowAnswers, Question } from "@/lib/flows";
import {
  defaultDateOptions,
  formatTargetLabel,
  isAllowedDirection,
  isValidDateString,
  normalizeTargetDate,
} from "@/lib/records/targetDate";
import { findExistingRecord, saveFlowRecord } from "./actions";
import { FlowDateChips } from "./FlowDateChips";

type Props = {
  flow: Flow;
  /** Issue #46: ?date=YYYY-MM-DD で初期 targetDate を pre-fill する経路。
   *  Home の date selector から「別日の morning を作る」リンクで使う。 */
  initialDate?: string;
};

export function FlowClient({ flow, initialDate }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<FlowAnswers>({});
  // target_date のデフォルト: ?date= で受け取った値があり、かつ flow の direction
  // 制約 (例: morning は未来も OK、weeklyReview は過去のみ等) を満たせばそれを採用。
  // 不正なら従来の「フローの今」(defaultDateOptions[0]) にフォールバック。
  const initialDateValidated = (() => {
    if (initialDate && isValidDateString(initialDate)) {
      const normalized = normalizeTargetDate(flow.type, initialDate);
      if (isAllowedDirection(flow.type, normalized, new Date())) {
        return normalized;
      }
    }
    return null;
  })();
  const [targetDate, setTargetDate] = useState<string>(
    () => initialDateValidated ?? defaultDateOptions(flow.type)[0].value,
  );
  // Issue #46 新方針 + team review P0: `?date=` 経由でも必ず日付選択 step を
  // 経由させる。初期値だけ pre-fill して、ユーザーは「次へ」で
  // findExistingRecord 経由で既存チェックする。これをやらないと
  // `?date=` のリンクから来た場合に重複 record が作られる (server 側に
  // (user, type, target_date) UNIQUE がないため)。
  const [dateConfirmed, setDateConfirmed] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const question = flow.questions[step];
  const isLastStep = step === flow.questions.length - 1;
  const progress = Math.round(((step + 1) / flow.questions.length) * 100);

  function updateAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    if (isLastStep) {
      setShowConfirm(true);
      return;
    }
    setStep((s) => s + 1);
  }

  function goBack() {
    // Issue #46 新方針: 日付選択 step は常に経由する設計なので、step 0 で戻ると
    // 日付選択 step に戻る (`?date=` 経由でも同じ)。
    if (step === 0) {
      setDateConfirmed(false);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveFlowRecord(flow.type, answers, targetDate);
        if (result.ok) {
          router.push("/");
        } else {
          setError(result.error ?? "保存に失敗しました");
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "保存に失敗しました";
        setError(message);
      }
    });
  }

  const targetLabel = formatTargetLabel(flow.type, targetDate);

  function handleDateConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await findExistingRecord(flow.type, targetDate);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.id) {
          // 既存 record あり → 編集モードへ。
          // from=flow を付けて EditClient 側で「キャンセルで日付選択に戻る」
          // 「保存後ホームへ戻る」を切り替えできるようにする。
          router.push(`/flows/${flow.type}?edit=${result.id}&from=flow`);
          return;
        }
        // 既存無し → 通常の作成フロー (step 0 へ)
        setDateConfirmed(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "確認に失敗しました";
        setError(message);
      }
    });
  }

  // Issue #46 新方針: 日付選択ステップ。初期表示で「いつのセットアップ?」を聞く。
  if (!dateConfirmed) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {flow.label}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            いつのぶんを書きますか？
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            日付を選んでください。すでにその日の記録があれば編集モードで開きます。
          </p>
        </header>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
          <FlowDateChips
            type={flow.type}
            value={targetDate}
            onChange={setTargetDate}
          />
          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-rose-600 dark:text-rose-400"
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              disabled={isPending}
              className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={handleDateConfirm}
              disabled={isPending}
              className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? "確認中..." : "次へ"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (showConfirm) {
    return (
      <ConfirmScreen
        flow={flow}
        answers={answers}
        targetLabel={targetLabel}
        onBack={() => setShowConfirm(false)}
        onSave={handleSave}
        isPending={isPending}
        error={error}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
          {flow.label} · {targetLabel}
        </span>
        <span className="text-xs text-zinc-500">{flow.intro}</span>
      </header>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
        {/* PR #47 review: 日付は専用 step で選び終わっているので、質問ステップ
            では FlowDateChips を出さない (二重 UI 回避)。確認画面 (ConfirmScreen)
            では targetLabel で日付を表示する。 */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>
              {step + 1} / {flow.questions.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <QuestionField
          question={question}
          answers={answers}
          onChange={updateAnswer}
        />

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            // step=0 でも日付選択 step に戻れる (= 常に back 有効)。
            className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            {isLastStep ? "一覧で確認する" : "次へ"}
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          {question.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{question.helper}</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {question.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm font-bold text-zinc-700">
                {field.label}
              </span>
              <textarea
                value={answers[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="min-h-28 w-full resize-none rounded-3xl border border-zinc-300 bg-zinc-50 px-5 py-4 text-base leading-7 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-100"
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        {question.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{question.helper}</p>
      <div className="mt-7">
        {question.kind === "textarea" ? (
          <textarea
            value={answers[question.key] ?? ""}
            onChange={(e) => onChange(question.key, e.target.value)}
            placeholder={question.placeholder}
            className="min-h-36 w-full resize-none rounded-3xl border border-zinc-300 bg-zinc-50 px-5 py-4 text-base leading-7 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-100"
          />
        ) : (
          <input
            type="text"
            value={answers[question.key] ?? ""}
            onChange={(e) => onChange(question.key, e.target.value)}
            placeholder={question.placeholder}
            className="w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-5 py-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-100"
          />
        )}
      </div>
    </div>
  );
}

function ConfirmScreen({
  flow,
  answers,
  targetLabel,
  onBack,
  onSave,
  isPending,
  error,
}: {
  flow: Flow;
  answers: FlowAnswers;
  targetLabel: string;
  onBack: () => void;
  onSave: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        disabled={isPending}
        className="mb-6 text-sm font-semibold text-zinc-500 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ← 入力に戻る
      </button>

      <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-zinc-500">入力内容の確認</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          {flow.label} · {targetLabel}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          保存前に、入力した内容を一覧で確認できます。
        </p>

        <div className="mt-6 space-y-3">
          {flow.questions.map((q) =>
            q.kind === "group" ? (
              <div
                key={q.key}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <p className="text-xs font-semibold text-zinc-500">{q.title}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {q.fields.map((field) => (
                    <div key={field.key} className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-xs font-bold text-zinc-500">
                        {field.label}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-900">
                        {answers[field.key]?.trim() || "未入力"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                key={q.key}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <p className="text-xs font-semibold text-zinc-500">{q.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-900">
                  {answers[q.key]?.trim() || "未入力"}
                </p>
              </div>
            ),
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            disabled={isPending}
            className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            修正する
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
          >
            {isPending ? "保存中..." : "保存する"}
          </button>
        </div>
      </section>
    </main>
  );
}
