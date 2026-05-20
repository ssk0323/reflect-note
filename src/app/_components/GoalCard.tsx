import Link from "next/link";
import type { RecordRow } from "@/lib/records/types";
import { CheckableItem } from "./CheckableItem";

export type CheckableFieldKind = "goal" | "task";

export type CheckableField = {
  key: string;
  kind: CheckableFieldKind;
  // チェックボックスの隣に出す短いラベル (例: "目標", "タスク 1")
  label: string;
};

type Props = {
  title: string;
  emoji: string;
  // 記録があれば渡す。なければ未設定状態を表示
  record: RecordRow | null;
  // チェック対象のフィールド。goal と task が混在して渡されるが、
  // 内部で 2 セクションに分けて表示する。
  checkableFields: CheckableField[];
  // 未設定時のメッセージ
  emptyMessage: string;
  // 未設定時に押すリンクの URL とラベル
  emptyCta: { href: string; label: string };
  // 設定済みでも「編集する」リンクを出すなら href を指定
  editHref?: string;
};

type VisibleItem = {
  key: string;
  kind: CheckableFieldKind;
  label: string;
  text: string;
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
  const visibleItems: VisibleItem[] = record
    ? checkableFields
        .map((f) => ({
          key: f.key,
          kind: f.kind,
          label: f.label,
          text: record.answers[f.key]?.trim() ?? "",
        }))
        .filter((item) => item.text.length > 0)
    : [];

  const goals = visibleItems.filter((i) => i.kind === "goal");
  const tasks = visibleItems.filter((i) => i.kind === "task");

  return (
    <article className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
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
          <div className="mt-4 space-y-5">
            {visibleItems.length === 0 ? (
              <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                目標とタスクが未入力です。
              </p>
            ) : (
              <>
                {goals.length > 0 && (
                  <CheckableSection
                    sectionLabel="目標"
                    accentClass="bg-amber-500"
                    items={goals}
                    record={record}
                  />
                )}
                {tasks.length > 0 && (
                  <CheckableSection
                    sectionLabel="タスク"
                    accentClass="bg-sky-500"
                    items={tasks}
                    record={record}
                  />
                )}
              </>
            )}
          </div>
          {editHref && (
            <div className="mt-4 text-right">
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

function CheckableSection({
  sectionLabel,
  accentClass,
  items,
  record,
}: {
  sectionLabel: string;
  accentClass: string;
  items: VisibleItem[];
  record: RecordRow;
}) {
  return (
    <section aria-label={sectionLabel}>
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${accentClass}`}
        />
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {sectionLabel}
        </h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <CheckableItem
            key={item.key}
            recordId={record.id}
            fieldKey={item.key}
            text={item.text}
            sublabel={item.label}
            initialChecked={record.checks[item.key] === true}
          />
        ))}
      </div>
    </section>
  );
}
