"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TODO_BUCKETS,
  TODO_BUCKET_LABEL,
  type TodoBucket,
  type TodoRow,
} from "@/lib/todos/types";
import {
  acceptCarryProposal,
  carryTodoToTomorrow,
  createTodo,
  deleteTodo,
  reorderTodo,
  toggleTodoDone,
  updateTodo,
} from "@/app/_todos/actions";

type Props = {
  /** 今日 (target_date) の ToDo 一覧 */
  todos: TodoRow[];
  /** 今日の日付 (YYYY-MM-DD, JST) — 新規作成や carry の target */
  todayDate: string;
  /** 「夜の `→明日` リンクを出すか」(夜時間帯のみ) */
  showCarryAction: boolean;
  /** 朝時間帯で、昨日未完了がある場合は提案カード用に渡す */
  carryProposal?: TodoRow[];
};

export function TodoCard({
  todos,
  todayDate,
  showCarryAction,
  carryProposal = [],
}: Props) {
  const byBucket = groupByBucket(todos);
  const total = todos.length;
  const doneCount = todos.filter((t) => t.done).length;
  const starDone = todos.filter((t) => t.important && t.done).length;
  const starTotal = todos.filter((t) => t.important).length;

  return (
    <article
      className="sk-card"
      aria-label="本日の ToDo"
      style={{
        padding: 18,
        borderColor: "var(--color-ink)",
        borderWidth: "1.5px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-baseline justify-between pb-2 mb-2"
        style={{ borderBottom: "1px dashed var(--color-line-soft)" }}
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              color: "var(--color-ink-3)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            本日の ToDo · 時間バケット
          </span>
          <span className="sk-mono">
            <span aria-hidden style={{ color: "var(--color-accent)" }}>
              ★
            </span>{" "}
            = 大事な 3 つ
          </span>
        </div>
      </div>

      {/* 朝の引き継ぎ提案 */}
      {carryProposal.length > 0 && (
        <CarryProposalCard
          proposals={carryProposal}
          todayDate={todayDate}
        />
      )}

      {/* バケットごとのリスト */}
      {TODO_BUCKETS.map((bucket) => {
        const items = byBucket[bucket];
        if (items.length === 0) return null;
        const bDone = items.filter((t) => t.done).length;
        return (
          <section
            key={bucket}
            aria-label={`${TODO_BUCKET_LABEL[bucket]}のタスク`}
            className="mb-3"
          >
            <div
              className="flex items-baseline gap-2 pb-1"
              style={{ borderBottom: "1px solid var(--color-line)" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "var(--color-ink-3)",
                  textTransform: "uppercase",
                }}
              >
                {TODO_BUCKET_LABEL[bucket]}
              </span>
              <span className="sk-mono" style={{ color: "var(--color-ink-4)" }}>
                · {bDone} / {items.length}
              </span>
            </div>
            <div>
              {items.map((t, idx) => (
                <TodoListRow
                  key={t.id}
                  todo={t}
                  isFirst={idx === 0}
                  isLast={idx === items.length - 1}
                  showCarryAction={showCarryAction}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Add row */}
      <TodoAddRow todayDate={todayDate} />

      {/* Footer */}
      <div
        className="flex items-center justify-between mt-3 pt-2"
        style={{ borderTop: "1px dashed var(--color-line-soft)" }}
      >
        <span className="sk-mono">
          {doneCount} / {total} 達成
          {starTotal > 0 && ` · 大事な3つ ${starDone}/${starTotal}`}
        </span>
        <span
          className="sk-mono"
          style={{ color: "var(--color-ink-4)" }}
        >
          ↑↓ で並び替え
        </span>
      </div>
    </article>
  );
}

function groupByBucket(todos: TodoRow[]): Record<TodoBucket, TodoRow[]> {
  const map: Record<TodoBucket, TodoRow[]> = {
    morning: [],
    forenoon: [],
    afternoon: [],
    night: [],
  };
  for (const t of todos) {
    map[t.bucket].push(t);
  }
  // bucket 内は position 順 (DB 取得時点で order 済みだが安全のため再 sort)
  for (const k of TODO_BUCKETS) {
    map[k].sort((a, b) => a.position - b.position);
  }
  return map;
}

// ----------------------------------------------------------------------------
// TodoListRow
// ----------------------------------------------------------------------------

function TodoListRow({
  todo,
  isFirst,
  isLast,
  showCarryAction,
}: {
  todo: TodoRow;
  isFirst: boolean;
  isLast: boolean;
  showCarryAction: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(todo.done);
  const [error, setError] = useState<string | null>(null);

  function withRefresh(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          router.refresh();
        } else {
          setError(r.error ?? "操作に失敗しました");
        }
      } catch (e) {
        console.error("todo action threw", e);
        setError("操作に失敗しました。時間をおいて再度お試しください。");
      }
    });
  }

  function handleToggle() {
    if (isPending) return;
    const previous = checked;
    const next = !previous;
    setChecked(next);
    startTransition(async () => {
      try {
        const r = await toggleTodoDone(todo.id, next);
        if (!r.ok) {
          setChecked(previous);
          setError(r.error ?? "操作に失敗しました");
        }
      } catch (e) {
        setChecked(previous);
        console.error("toggleTodoDone threw", e);
        setError("操作に失敗しました");
      }
    });
  }

  return (
    <div
      className="flex items-center gap-2 py-1.5"
      style={{
        padding: todo.important ? "10px 4px" : "7px 4px",
        borderBottom: "1px dashed var(--color-line-soft)",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={handleToggle}
        disabled={isPending}
        aria-label={todo.text}
        className="h-4 w-4 cursor-pointer rounded-sm"
        style={{
          borderColor: "var(--color-ink-2)",
          accentColor: "var(--color-accent)",
        }}
      />
      {todo.important && (
        <span
          aria-label="大事な 3 つの 1 つ"
          style={{
            color: "var(--color-accent)",
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          ★
        </span>
      )}
      <span
        className="flex-1"
        style={{
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: todo.important ? 17 : 15,
          fontWeight: todo.important ? 700 : 400,
          color: checked ? "var(--color-ink-3)" : "var(--color-ink)",
          textDecoration: checked ? "line-through" : "none",
          textDecorationThickness: "1px",
          lineHeight: 1.4,
        }}
      >
        {todo.text}
      </span>
      {todo.carry_from_date && (
        <span
          className="sk-mono"
          style={{ flexShrink: 0, color: "var(--color-ink-4)" }}
          aria-label={`${todo.carry_from_date} から引き継ぎ`}
        >
          ↺
        </span>
      )}
      <span
        className="sk-chip"
        style={{
          flexShrink: 0,
          color: "var(--color-ink-2)",
          borderColor: "var(--color-line)",
        }}
      >
        {todo.time ?? TODO_BUCKET_LABEL[todo.bucket]}
      </span>
      {showCarryAction && !checked && (
        <button
          type="button"
          onClick={() => withRefresh(() => carryTodoToTomorrow(todo.id))}
          disabled={isPending}
          className="sk-mono"
          style={{
            flexShrink: 0,
            color: "var(--color-ink-3)",
            cursor: "pointer",
            background: "transparent",
            border: "none",
          }}
          aria-label="このタスクを明日に引き継ぐ"
        >
          → 明日
        </button>
      )}
      {/* Reorder buttons */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => withRefresh(() => reorderTodo(todo.id, "up"))}
          disabled={isPending || isFirst}
          aria-label="上に移動"
          className="sk-mono"
          style={{
            color: isFirst ? "var(--color-ink-4)" : "var(--color-ink-3)",
            background: "transparent",
            border: "none",
            cursor: isFirst ? "not-allowed" : "pointer",
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ▴
        </button>
        <button
          type="button"
          onClick={() => withRefresh(() => reorderTodo(todo.id, "down"))}
          disabled={isPending || isLast}
          aria-label="下に移動"
          className="sk-mono"
          style={{
            color: isLast ? "var(--color-ink-4)" : "var(--color-ink-3)",
            background: "transparent",
            border: "none",
            cursor: isLast ? "not-allowed" : "pointer",
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ▾
        </button>
      </div>
      <TodoRowMenu todo={todo} onDelete={() => withRefresh(() => deleteTodo(todo.id))} isPending={isPending} />
      {error && (
        <p role="alert" className="sk-mono" style={{ color: "var(--color-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function TodoRowMenu({
  todo,
  onDelete,
  isPending,
}: {
  todo: TodoRow;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-label="タスク操作メニュー"
        aria-haspopup="menu"
        aria-expanded={open}
        className="sk-mono"
        style={{
          color: "var(--color-ink-4)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "0 4px",
          fontSize: 14,
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`${todo.text} の操作`}
          className="sk-card"
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            zIndex: 10,
            padding: 6,
            background: "var(--color-bg)",
            minWidth: 120,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (window.confirm("このタスクを削除しますか？")) onDelete();
            }}
            className="sk-mono w-full text-left"
            style={{
              padding: "6px 10px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--color-warn)",
            }}
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// TodoAddRow
// ----------------------------------------------------------------------------

function TodoAddRow({ todayDate }: { todayDate: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [bucket, setBucket] = useState<TodoBucket>("forenoon");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!text.trim() || isPending) return;
    setError(null);
    const payload = { text: text.trim(), targetDate: todayDate, bucket };
    startTransition(async () => {
      try {
        const r = await createTodo(payload);
        if (r.ok) {
          setText("");
          router.refresh();
        } else {
          setError(r.error ?? "追加に失敗しました");
        }
      } catch (e) {
        console.error("createTodo threw", e);
        setError("追加に失敗しました。時間をおいて再度お試しください。");
      }
    });
  }

  return (
    <div
      className="flex items-center gap-2 mt-2 py-2"
      aria-label="新しいタスクを追加"
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          border: "1.2px dashed var(--color-ink-4)",
          borderRadius: 5,
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        disabled={isPending}
        placeholder="タスクを追加..."
        aria-label="タスクの内容"
        className="flex-1"
        style={{
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 15,
          background: "transparent",
          border: "none",
          color: "var(--color-ink)",
          outline: "none",
        }}
      />
      <select
        value={bucket}
        onChange={(e) => setBucket(e.target.value as TodoBucket)}
        disabled={isPending}
        aria-label="時間バケット"
        className="sk-chip"
        style={{ cursor: "pointer", background: "var(--color-bg)" }}
      >
        {TODO_BUCKETS.map((b) => (
          <option key={b} value={b}>
            {TODO_BUCKET_LABEL[b]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !text.trim()}
        className="sk-btn sk-btn-ink"
        style={{ fontSize: 13, padding: "4px 10px" }}
      >
        追加
      </button>
      {error && (
        <p role="alert" className="sk-mono" style={{ color: "var(--color-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// CarryProposalCard (朝の「昨日からの引き継ぎ」)
// ----------------------------------------------------------------------------

function CarryProposalCard({
  proposals,
  todayDate,
}: {
  proposals: TodoRow[];
  todayDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function acceptAll() {
    if (isPending) return;
    setError(null);
    const ids = proposals.map((p) => p.id);
    startTransition(async () => {
      try {
        const r = await acceptCarryProposal(ids, todayDate);
        if (r.ok) {
          router.refresh();
        } else {
          setError(r.error ?? "取り込みに失敗しました");
        }
      } catch (e) {
        console.error("acceptCarryProposal threw", e);
        setError("取り込みに失敗しました");
      }
    });
  }

  return (
    <div
      className="sk-card sk-card-dashed mb-3"
      style={{ padding: 12 }}
      aria-label="昨日からの引き継ぎ提案"
    >
      <div className="flex items-baseline justify-between">
        <span className="sk-eyebrow">
          昨日からの引き継ぎ · {proposals[0]?.target_date} 未完了
        </span>
        <span className="sk-mono">{proposals.length}件</span>
      </div>
      <ul className="mt-2 space-y-1">
        {proposals.map((p) => (
          <li
            key={p.id}
            className="text-sm"
            style={{ color: "var(--color-ink-2)" }}
          >
            ・{p.text}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={acceptAll}
          disabled={isPending}
          className="sk-btn sk-btn-ink"
          style={{ fontSize: 13, padding: "6px 12px" }}
        >
          今日の ToDo に追加（{proposals.length}件）
        </button>
      </div>
      {error && (
        <p role="alert" className="sk-mono mt-1" style={{ color: "var(--color-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// Bonus: allow updating bucket inline via a separate API. (Not yet wired into UI;
// the `updateTodo` action exists for future inline-edit features.)
void updateTodo;
