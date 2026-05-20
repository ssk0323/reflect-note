"use client";

import { useState, useTransition } from "react";
import { toggleCheck } from "@/app/actions";

type Props = {
  recordId: string;
  fieldKey: string;
  text: string;
  initialChecked: boolean;
};

export function CheckableItem({
  recordId,
  fieldKey,
  text,
  initialChecked,
}: Props) {
  const [checked, setChecked] = useState(initialChecked);
  const [, startTransition] = useTransition();
  const inputId = `${recordId}-${fieldKey}`;

  function handleChange() {
    // 楽観的更新: 即時 UI に反映してから Server Action を呼ぶ
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      try {
        const result = await toggleCheck(recordId, fieldKey);
        if (!result.ok) {
          // 失敗時は元に戻す
          setChecked(!next);
        }
      } catch {
        setChecked(!next);
      }
    });
  }

  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="mt-1 h-4 w-4 cursor-pointer rounded border-zinc-400 text-zinc-900 focus:ring-zinc-500"
      />
      <span
        className={`flex-1 whitespace-pre-wrap text-sm leading-6 ${
          checked
            ? "text-zinc-400 line-through dark:text-zinc-500"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {text}
      </span>
    </label>
  );
}
