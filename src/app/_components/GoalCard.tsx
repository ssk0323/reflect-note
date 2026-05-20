import Link from "next/link";
import type { RecordRow } from "@/lib/records/types";
import { CheckableItem } from "./CheckableItem";

type CheckableField = {
  key: string;
  // 表示用のラベル (例: "今日の目標", "タスク 1")
  fallbackLabel: string;
};

type Props = {
  title: string;
  emoji: string;
  // 記録があれば渡す。なければ未設定状態を表示
  record: RecordRow | null;
  // チェック対象のフィールド (上から順に表示)
  checkableFields: CheckableField[];
  // 未設定時のメッセージ
  emptyMessage: string;
  // 未設定時に押すリンクの URL とラベル
  emptyCta: { href: string; label: string };
  // 設定済みでも「編集する」リンクを出すなら href を指定
  editHref?: string;
};

export function GoalCard({
  title,
  emoji,
  record,
  checkableFields,
  emptyMessage,
  emptyCta,
  editHref,
}: Props) {
  const visibleItems = record
    ? checkableFields
        .map((f) => ({
          key: f.key,
          text: record.answers[f.key]?.trim() ?? "",
          fallback: f.fallbackLabel,
        }))
        .filter((item) => item.text.length > 0)
    : [];

  return (
    <article className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
      </div>

      {record == null ? (
        <div className="mt-4 flex flex-1 flex-col items-start gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {emptyMessage}
          </p>
          <Link
            href={emptyCta.href}
            className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {emptyCta.label}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {visibleItems.length === 0 ? (
              <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                目標とタスクが未入力です。
              </p>
            ) : (
              visibleItems.map((item) => (
                <CheckableItem
                  key={item.key}
                  recordId={record.id}
                  fieldKey={item.key}
                  text={item.text}
                  initialChecked={record.checks[item.key] === true}
                />
              ))
            )}
          </div>
          {editHref && (
            <div className="mt-3 text-right">
              <Link
                href={editHref}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              >
                編集する →
              </Link>
            </div>
          )}
        </>
      )}
    </article>
  );
}
