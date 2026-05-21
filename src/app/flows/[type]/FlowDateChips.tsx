"use client";

import type { FlowType } from "@/lib/flows";
import {
  defaultDateOptions,
  flowDirection,
  isAllowedDirection,
  normalizeTargetDate,
  isValidDateString,
  type DateOption,
} from "@/lib/records/targetDate";

type Props = {
  type: FlowType;
  value: string; // 現在の target_date (YYYY-MM-DD)
  onChange: (next: string) => void;
  // テスト用に固定時刻を渡す
  now?: Date;
};

/** target_date の選択 UI。デフォルト 3 つの chip + ネイティブ date input。 */
export function FlowDateChips({ type, value, onChange, now }: Props) {
  const options: DateOption[] = defaultDateOptions(type, now ?? new Date());
  const direction = flowDirection(type);
  const headline = direction === "future" ? "いつの分を書きますか？" : "いつの振り返りですか？";

  const todayValue = options[0].value;
  const minDate = direction === "future" ? todayValue : undefined;
  const maxDate = direction === "past" ? todayValue : undefined;

  // value が options に含まれていない場合は「その他」扱い
  const isPredefined = options.some((o) => o.value === value);

  function handleDateInput(raw: string) {
    if (!isValidDateString(raw)) return;
    const normalized = normalizeTargetDate(type, raw);
    if (!isAllowedDirection(type, normalized, now ?? new Date())) return;
    onChange(normalized);
  }

  return (
    <fieldset className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <legend className="px-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
        {headline}
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={headline}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={`rounded-2xl border px-4 py-2 text-left text-sm transition ${
                selected
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="block text-sm font-bold">{opt.label}</span>
              <span className="block text-xs opacity-80">{opt.detail}</span>
            </button>
          );
        })}
        <label className="flex items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950">
          <span className="text-zinc-600 dark:text-zinc-400">その他</span>
          <input
            type="date"
            value={isPredefined ? "" : value}
            min={minDate}
            max={maxDate}
            onChange={(e) => handleDateInput(e.target.value)}
            aria-label="日付を直接指定"
            className="bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-100"
          />
        </label>
      </div>
    </fieldset>
  );
}
