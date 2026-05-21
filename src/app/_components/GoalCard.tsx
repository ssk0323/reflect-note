import Link from "next/link";
import type { RecordRow } from "@/lib/records/types";
import { CheckableItem } from "./CheckableItem";

export type CheckableFieldKind = "goal" | "task";

export type CheckableField = {
  key: string;
  kind: CheckableFieldKind;
  label: string;
};

type Props = {
  title: string;
  emoji: string;
  subtitle?: string;
  record: RecordRow | null;
  checkableFields: CheckableField[];
  emptyMessage: string;
  emptyCta: { href: string; label: string };
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
  subtitle,
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
  const checkedCount = visibleItems.filter(
    (i) => record?.checks[i.key] === true,
  ).length;

  return (
    <article className="sk-card flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>
              {emoji}
            </span>
            <h2 className="sk-h">{title}</h2>
          </div>
          {subtitle && <p className="sk-mono mt-1">{subtitle}</p>}
        </div>
        {record != null && editHref && (
          <Link
            href={editHref}
            aria-label={`${title}を編集する`}
            className="sk-mono inline-flex items-center hover:text-[var(--color-ink)]"
          >
            <span aria-hidden>✏️ </span>編集 ›
          </Link>
        )}
      </div>

      {record == null ? (
        <div
          className="sk-card-dashed mt-3 flex flex-1 flex-col items-start gap-3 p-4"
          style={{
            border: "1.2px dashed var(--color-line)",
            borderRadius: "var(--sketch-radius-card)",
          }}
        >
          <p className="text-sm leading-6" style={{ color: "var(--color-ink-2)" }}>
            {emptyMessage}
          </p>
          <Link href={emptyCta.href} className="sk-btn sk-btn-ink">
            {emptyCta.label}
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {visibleItems.length === 0 ? (
            <p
              className="rounded-2xl p-3 text-sm"
              style={{
                background: "var(--color-bg-2)",
                color: "var(--color-ink-2)",
              }}
            >
              目標とタスクが未入力です。
            </p>
          ) : (
            <>
              {goals.length > 0 && (
                <CheckableSection
                  sectionLabel="目標"
                  items={goals}
                  record={record}
                />
              )}
              {tasks.length > 0 && (
                <CheckableSection
                  sectionLabel="タスク"
                  items={tasks}
                  record={record}
                />
              )}
              <div className="flex items-center justify-between">
                <span className="sk-mono">
                  {checkedCount} / {visibleItems.length} 達成
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function CheckableSection({
  sectionLabel,
  items,
  record,
}: {
  sectionLabel: string;
  items: VisibleItem[];
  record: RecordRow;
}) {
  return (
    <section aria-label={sectionLabel}>
      <p className="sk-eyebrow mb-2">{sectionLabel}</p>
      <div className="space-y-1.5">
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
