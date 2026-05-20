"use client";

import { useState, useTransition } from "react";
import { toggleCheck } from "@/app/actions";

type Props = {
  recordId: string;
  fieldKey: string;
  text: string;
  initialChecked: boolean;
  // 「タスク 1」「目標」など、本文の上に小さく表示する補助ラベル
  sublabel?: string;
};

export function CheckableItem({
  recordId,
  fieldKey,
  text,
  initialChecked,
  sublabel,
}: Props) {
  const [checked, setChecked] = useState(initialChecked);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = `${recordId}-${fieldKey}`;

  function handleChange() {
    if (isPending) return; // 連打耐性
    // 楽観的更新: 反転前の値を保持しておき、失敗したら戻す
    const previous = checked;
    const next = !previous;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      try {
        const result = await toggleCheck(recordId, fieldKey);
        if (!result.ok) {
          setChecked(previous);
          setError(result.error ?? "保存に失敗しました");
        } else {
          // サーバーが返す確定値で同期 (atomic toggle なので next と一致するはず)
          setChecked(result.checked);
        }
      } catch (e) {
        setChecked(previous);
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor={inputId}
        className={`flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition dark:border-zinc-800 dark:bg-zinc-950 ${
          isPending
            ? "cursor-wait opacity-70"
            : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={isPending}
          className="mt-1 h-4 w-4 cursor-pointer rounded border-zinc-400 text-zinc-900 focus:ring-zinc-500 disabled:cursor-wait"
        />
        <span className="flex-1">
          {sublabel && (
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {sublabel}
            </span>
          )}
          <span
            className={`block whitespace-pre-wrap text-sm leading-6 ${
              checked
                ? "text-zinc-500 line-through dark:text-zinc-400"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {text}
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="px-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
