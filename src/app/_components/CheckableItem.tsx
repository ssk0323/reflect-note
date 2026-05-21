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
        className={`flex items-start gap-3 py-1 ${
          isPending ? "cursor-wait opacity-60" : "cursor-pointer"
        }`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={isPending}
          className="mt-1 h-4 w-4 cursor-pointer rounded-sm border-2 focus:ring-2 disabled:cursor-wait"
          style={{
            borderColor: "var(--color-ink-2)",
            accentColor: "var(--color-accent)",
          }}
        />
        <span className="flex-1">
          {sublabel && <span className="sk-eyebrow mb-0.5">{sublabel}</span>}
          <span
            className="block whitespace-pre-wrap text-sm leading-6"
            style={
              checked
                ? {
                    color: "var(--color-ink-3)",
                    textDecoration: "line-through",
                    textDecorationThickness: "1px",
                  }
                : { color: "var(--color-ink)" }
            }
          >
            {text}
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="px-1 text-xs" style={{ color: "var(--color-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
