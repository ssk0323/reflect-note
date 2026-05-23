"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
// useEffect は menu の外側クリック/Escape 検知でのみ使用 (setState in effect 警告対象外)
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
} from "@/app/_todos/actions";

type Props = {
  todos: TodoRow[];
  todayDate: string;
  showCarryAction: boolean;
  carryProposal?: TodoRow[];
};

export function TodoCard({
  todos,
  todayDate,
  showCarryAction,
  carryProposal = [],
}: Props) {
  const byBucket = groupByBucket(todos);

  // 達成集計はサーバから来た todos で常に再計算 (P2 toggle 後の集計未更新を解消)。
  const total = todos.length;
  const doneCount = todos.filter((t) => t.done).length;
  const starDone = todos.filter((t) => t.important && t.done).length;
  const starTotal = todos.filter((t) => t.important).length;

  // 1 行だけ menu を open にするための global close 機構 (a11y P0)。
  // 各 TodoListRow が menuToken を保持し、別 row が open になったら自分は閉じる。
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              ))}
            </div>
          </section>
        );
      })}

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
        <span className="sk-mono" style={{ color: "var(--color-ink-4)" }}>
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
  openMenuId,
  setOpenMenuId,
}: {
  todo: TodoRow;
  isFirst: boolean;
  isLast: boolean;
  showCarryAction: boolean;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(todo.done);
  // 前回の props.done を覚えておき、render 中に変わっていれば state を同期する。
  // (React 公式推奨パターン: "Storing information from previous renders"。
  //  useEffect で setState だと react-hooks/set-state-in-effect で警告される。)
  // team review P0: `useState(todo.done)` だけだと props 変更後も古い checked が残る。
  const [prevDone, setPrevDone] = useState(todo.done);
  if (todo.done !== prevDone) {
    setPrevDone(todo.done);
    setChecked(todo.done);
  }
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const refresh = useCallback(() => router.refresh(), [router]);

  function handleToggle() {
    if (isPending) return;
    const previous = checked;
    const next = !previous;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      try {
        const r = await toggleTodoDone(todo.id, next);
        if (!r.ok) {
          setChecked(previous);
          setError(r.error ?? "操作に失敗しました");
        } else {
          // 集計 (footer) を更新するため refresh (team review P2)
          refresh();
        }
      } catch (e) {
        setChecked(previous);
        console.error("toggleTodoDone threw", e);
        setError("操作に失敗しました");
      }
    });
  }

  function handleReorder(direction: "up" | "down") {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await reorderTodo(todo.id, direction);
        if (r.ok) refresh();
        else setError(r.error ?? "並び替えに失敗しました");
      } catch (e) {
        console.error("reorderTodo threw", e);
        setError("並び替えに失敗しました");
      }
    });
  }

  function handleCarry() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await carryTodoToTomorrow(todo.id);
        if (r.ok) refresh();
        else setError(r.error ?? "引き継ぎに失敗しました");
      } catch (e) {
        console.error("carryTodoToTomorrow threw", e);
        setError("引き継ぎに失敗しました");
      }
    });
  }

  function handleDelete() {
    if (isPending) return;
    if (!window.confirm("このタスクを削除しますか？")) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await deleteTodo(todo.id);
        if (r.ok) refresh();
        else setError(r.error ?? "削除に失敗しました");
      } catch (e) {
        console.error("deleteTodo threw", e);
        setError("削除に失敗しました");
      }
    });
  }

  return (
    <div
      role="group"
      aria-busy={isPending}
      className="grid items-center gap-2 py-2"
      style={{
        gridTemplateColumns: "auto 1fr auto",
        padding: todo.important ? "10px 4px" : "7px 4px",
        borderBottom: "1px dashed var(--color-line-soft)",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {/* 左: checkbox (label でラップして a11y を整える) */}
      <label
        htmlFor={inputId}
        className="flex items-center gap-2 cursor-pointer min-w-0"
        style={{ gridColumn: "1 / span 2" }}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={handleToggle}
          disabled={isPending}
          className="h-4 w-4 cursor-pointer rounded-sm flex-shrink-0"
          style={{
            borderColor: "var(--color-ink-2)",
            accentColor: "var(--color-accent)",
          }}
        />
        {todo.important && (
          <span
            aria-hidden
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
          className="min-w-0 truncate"
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
          {todo.important && (
            <span className="sr-only">重要なタスク: </span>
          )}
          {todo.text}
        </span>
      </label>

      {/* 中央: bucket chip + carry chip。モバイルではコンパクト表示 */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0 flex-wrap"
        style={{ gridColumn: "3" }}
      >
        {todo.carry_from_date && (
          <span
            className="sk-mono"
            style={{ color: "var(--color-ink-4)" }}
            aria-label={`${todo.carry_from_date} から引き継ぎ`}
            title={`${todo.carry_from_date} から引き継ぎ`}
          >
            ↺
          </span>
        )}
        <span
          aria-hidden
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "4px 9px",
            border: "1.2px solid var(--color-line)",
            borderRadius: 10,
            color: "var(--color-ink-3)",
            background: "var(--color-bg)",
          }}
        >
          {todo.time ?? TODO_BUCKET_LABEL[todo.bucket]}
        </span>
        {showCarryAction && !checked && (
          <button
            type="button"
            onClick={handleCarry}
            disabled={isPending}
            aria-label={`「${todo.text}」を明日に引き継ぐ`}
            className="sk-mono"
            style={{
              color: "var(--color-ink-3)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px 6px",
              minHeight: 44,
              minWidth: 44,
            }}
          >
            <span aria-hidden>→</span>明日
          </button>
        )}
        <ReorderButtons
          onUp={() => handleReorder("up")}
          onDown={() => handleReorder("down")}
          isFirst={isFirst}
          isLast={isLast}
          disabled={isPending}
          taskName={todo.text}
        />
        <TodoRowMenu
          todo={todo}
          isOpen={openMenuId === todo.id}
          onToggleOpen={() => setOpenMenuId(openMenuId === todo.id ? null : todo.id)}
          onClose={() => setOpenMenuId(null)}
          onDelete={handleDelete}
          isPending={isPending}
        />
      </div>

      {/* エラー (alert) */}
      {error && (
        <p
          role="alert"
          className="sk-mono"
          style={{ color: "var(--color-warn)", gridColumn: "1 / -1" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function ReorderButtons({
  onUp,
  onDown,
  isFirst,
  isLast,
  disabled,
  taskName,
}: {
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  taskName: string;
}) {
  // ↑↓ は縦並びだが、タップターゲットは横幅もしっかり確保 (44px)。
  return (
    <div
      className="flex flex-col"
      role="group"
      aria-label={`${taskName} の並び替え`}
    >
      <button
        type="button"
        onClick={onUp}
        disabled={disabled || isFirst}
        aria-label="このタスクを上に移動"
        className="sk-mono"
        style={{
          color: isFirst ? "var(--color-ink-4)" : "var(--color-ink-3)",
          background: "transparent",
          border: "none",
          cursor: isFirst ? "not-allowed" : "pointer",
          padding: "6px 8px",
          minWidth: 44,
          lineHeight: 1,
        }}
      >
        ▴
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disabled || isLast}
        aria-label="このタスクを下に移動"
        className="sk-mono"
        style={{
          color: isLast ? "var(--color-ink-4)" : "var(--color-ink-3)",
          background: "transparent",
          border: "none",
          cursor: isLast ? "not-allowed" : "pointer",
          padding: "6px 8px",
          minWidth: 44,
          lineHeight: 1,
        }}
      >
        ▾
      </button>
    </div>
  );
}

function TodoRowMenu({
  todo,
  isOpen,
  onToggleOpen,
  onClose,
  onDelete,
  isPending,
}: {
  todo: TodoRow;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Escape で閉じる + trigger に focus 戻す (a11y P0)
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggleOpen}
        disabled={isPending}
        aria-label={`「${todo.text}」の操作メニュー`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="sk-mono"
        style={{
          color: "var(--color-ink-4)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "8px 10px",
          minHeight: 44,
          minWidth: 44,
          fontSize: 14,
        }}
      >
        ⋯
      </button>
      {isOpen && (
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
            minWidth: 140,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="sk-mono w-full text-left"
            style={{
              padding: "8px 10px",
              minHeight: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--color-warn)",
              width: "100%",
              display: "block",
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
  const inputRef = useRef<HTMLInputElement>(null);

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
          // refresh 後も入力欄に focus を残す (連続追加の UX)
          requestAnimationFrame(() => inputRef.current?.focus());
        } else {
          setError(r.error ?? "追加に失敗しました");
        }
      } catch (e) {
        console.error("createTodo threw", e);
        setError("追加に失敗しました。時間をおいて再度お試しください。");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // IME 確定時の Enter で誤 submit しない (team review P1)
    if (
      e.nativeEvent.isComposing ||
      (e as unknown as { keyCode: number }).keyCode === 229
    ) {
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && text) {
      e.preventDefault();
      setText("");
    }
  }

  return (
    <div
      className="flex items-center gap-2 mt-2 py-2 flex-wrap"
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
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        placeholder="タスクを追加..."
        aria-label="タスクの内容"
        className="flex-1 min-w-0"
        style={{
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 15,
          background: "transparent",
          border: "none",
          color: "var(--color-ink)",
          outline: "none",
          padding: "8px 4px",
          minHeight: 44,
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
      {text.trim() && (
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="sk-btn sk-btn-ink"
          style={{ fontSize: 13, padding: "8px 12px", minHeight: 44 }}
        >
          追加
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="sk-mono w-full"
          style={{ color: "var(--color-warn)" }}
        >
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
      aria-busy={isPending}
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
          style={{ fontSize: 13, padding: "8px 14px", minHeight: 44 }}
        >
          今日の ToDo に追加（{proposals.length}件）
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="sk-mono mt-1"
          style={{ color: "var(--color-warn)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
