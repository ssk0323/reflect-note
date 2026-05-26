"use client";

import { useId } from "react";
import type { FlowType } from "@/lib/flows";
import {
  dateInputBoundsForFlow,
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
  /** Issue #46: 編集モードでは日付変更を不可にするための readonly 表示。
   *  true のとき chip も date input も触れない (値だけ示す)。 */
  readOnly?: boolean;
};

/** target_date の選択 UI。デフォルト 3 つの chip + ネイティブ date input。
 *
 *  実装メモ: ネイティブ <input type="radio"> + <label> を使う。
 *  キーボード操作 (Tab / 矢印キー / Space) はブラウザのネイティブ動作に任せる
 *  ことで ARIA Radio Group パターンを自前実装する必要をなくしている。
 *
 *  readOnly: 編集モード (EditClient) で「これは XX 日の記録」と表示するための
 *  簡易表示。日付ピッカーを変更させない (= 既存 record の target_date を勝手に
 *  動かさない、Issue #46)。 */
export function FlowDateChips({ type, value, onChange, now, readOnly }: Props) {
  const options: DateOption[] = defaultDateOptions(type, now ?? new Date());
  const direction = flowDirection(type);
  const headline = direction === "future" ? "いつの分を書きますか？" : "いつの振り返りですか？";
  const groupName = useId();

  // date input の min/max は「期間の開始 / 終了」で day レベルに表現する。
  // 例: weeklyReview で options[0].value (= 今週月曜) を max にすると当週火曜以降を
  // 選べなくなるため、専用ヘルパー (期間終了日を返す) で計算する。
  const { min: minDate, max: maxDate } = dateInputBoundsForFlow(type, now ?? new Date());

  // value が options に含まれていない場合は「その他」扱い
  const isPredefined = options.some((o) => o.value === value);

  function handleDateInput(raw: string) {
    if (!isValidDateString(raw)) return;
    const normalized = normalizeTargetDate(type, raw);
    if (!isAllowedDirection(type, normalized, now ?? new Date())) return;
    onChange(normalized);
  }

  // readOnly: 編集モードでは記録の日付が動かないことを明示。
  // 選択中の option の label/detail を 1 行で表示するだけにする。
  if (readOnly) {
    const selectedOption = options.find((o) => o.value === value);
    const display = selectedOption
      ? `${selectedOption.label} (${selectedOption.detail})`
      : value;
    return (
      <fieldset
        aria-readonly="true"
        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <legend className="px-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          {headline}
        </legend>
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {display}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          編集中は日付を変えられません (別日に作成する場合はホームから新規作成)
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <legend className="px-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
        {headline}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = opt.value === value;
          const inputId = `${groupName}-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={inputId}
              className={`cursor-pointer rounded-2xl border px-4 py-2 text-left text-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-zinc-500 ${
                selected
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <input
                id={inputId}
                type="radio"
                name={groupName}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <span className="block text-sm font-bold">{opt.label}</span>
              <span className="block text-xs opacity-80">{opt.detail}</span>
            </label>
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
