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
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  moveTodo,
  toggleTodoDone,
  updateTodo,
} from "@/app/_todos/actions";
// reorderTodo は ↑↓ ボタン削除 (Issue #44) に伴い UI からは呼ばれなくなった。
// server action / RPC は互換性のため残してある。
import {
  applyBucketChangeOptimistic,
  applyDeleteOptimistic,
  applyMoveOptimistic,
  computeMoveTarget,
} from "./computeMoveTarget";

/** client 側で console.error する際に、ユーザー入力 text を含み得る Server Action
 *  の生 error をそのまま出さないようにする (team review 2 周目 P2)。
 *  name のみログし、Sentry 等の集約 SaaS 導入時に PII が漏れる経路を絶つ。 */
function redactClientError(e: unknown): { name: string } {
  if (e instanceof Error) return { name: e.name };
  return { name: typeof e };
}

type Props = {
  todos: TodoRow[];
  /** Issue #46 新方針: ToDo セクション内のタブで前日/今日/翌日を切替表示する。
   *  3 日分の todos を Home 側で fetch して渡す。viewDate は内部 state で持つ。 */
  prevDayTodos?: TodoRow[];
  nextDayTodos?: TodoRow[];
  todayDate: string;
  prevDayDate?: string;
  nextDayDate?: string;
  showCarryAction: boolean;
  carryProposal?: TodoRow[];
  /** 「今は朝/昼/夜のどれか」を渡すと TodoAddRow の bucket デフォルトが連動する */
  timeOfDay?: "morning" | "day" | "evening";
};

export function TodoCard({
  todos,
  prevDayTodos = [],
  nextDayTodos = [],
  todayDate,
  prevDayDate,
  nextDayDate,
  showCarryAction,
  carryProposal = [],
  timeOfDay = "day",
}: Props) {
  const router = useRouter();

  // Issue #46 新方針: 表示日タブ。default = 今日。
  const [viewDate, setViewDate] = useState<string>(todayDate);
  const isViewingToday = viewDate === todayDate;
  const isViewingPrev = prevDayDate !== undefined && viewDate === prevDayDate;
  // viewDate に対応する server todos を選ぶ
  const activeServerTodos = isViewingPrev
    ? prevDayTodos
    : !isViewingToday
      ? nextDayTodos
      : todos;

  // Issue #44 (optimistic UI): drop 直後にローカル並び替えを即時反映するため、
  // optimisticTodos を保持する。null = サーバの activeServerTodos をそのまま使う。
  // activeServerTodos (= props 3 日分のどれか、または viewDate 変化) が変わったら
  // optimistic はクリア。
  const [optimisticTodos, setOptimisticTodos] = useState<TodoRow[] | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState({
    serverTodos: activeServerTodos,
    viewDate,
  });
  if (
    activeServerTodos !== prevSnapshot.serverTodos ||
    viewDate !== prevSnapshot.viewDate
  ) {
    setPrevSnapshot({ serverTodos: activeServerTodos, viewDate });
    setOptimisticTodos(null);
  }
  const effectiveTodos = optimisticTodos ?? activeServerTodos;
  const byBucket = groupByBucket(effectiveTodos);

  // 達成集計は表示用 todos (optimistic 反映後) で再計算。
  const total = effectiveTodos.length;
  const doneCount = effectiveTodos.filter((t) => t.done).length;
  const starDone = effectiveTodos.filter(
    (t) => t.important && t.done,
  ).length;
  const starTotal = effectiveTodos.filter((t) => t.important).length;

  // 1 行だけ menu を open にするための global close 機構 (a11y P0)。
  // 各 TodoListRow が menuToken を保持し、別 row が open になったら自分は閉じる。
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Issue #44: ハンドル drag (@dnd-kit)。bucket 順に flatten した sortable 配列を作る。
  // bucket 内の順序は byBucket がソート済み。各 row は useSortable で id を登録。
  // 全 bucket 共通の SortableContext 1 つで、bucket 跨ぎ drag も成立する。
  const flatItems = TODO_BUCKETS.flatMap((b) =>
    byBucket[b].map((t) => ({ id: t.id, bucket: b })),
  );
  const flatIds = flatItems.map((t) => t.id);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [, startReorderTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px 動かさないと drag 開始しない。タップ操作 (= clickなど) と区別。
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // PR #45 review: 削除 / 時間帯変更 も同じ optimisticTodos を介して即時反映する。
  // 各 callback は「server 通信を始める前に呼ばれる」前提。失敗時は revert を呼ぶ。
  // base は viewDate に対応する activeServerTodos (Issue #46 新方針)。
  const applyOptimisticDelete = useCallback(
    (id: string) => {
      setOptimisticTodos((current) =>
        applyDeleteOptimistic(current ?? activeServerTodos, id),
      );
    },
    [activeServerTodos],
  );

  const applyOptimisticBucketChange = useCallback(
    (id: string, newBucket: TodoBucket) => {
      setOptimisticTodos((current) =>
        applyBucketChangeOptimistic(current ?? activeServerTodos, id, newBucket),
      );
    },
    [activeServerTodos],
  );

  const revertOptimistic = useCallback(() => {
    setOptimisticTodos(null);
  }, []);

  // 新規追加の楽観 UI: TodoAddRow から渡された全フィールド入り todo を即座に
  // optimisticTodos に追加。server INSERT も同じ id で投げる → refresh で同期。
  const applyOptimisticCreate = useCallback(
    (newTodo: TodoRow) => {
      setOptimisticTodos((current) => {
        const base = current ?? activeServerTodos;
        return [...base, newTodo];
      });
    },
    [activeServerTodos],
  );

  // 削除 / 時間帯変更は行が remount するため TodoListRow ローカルの error state は
  // 失われる。エラー表示は親 (TodoCard) に lift して banner で出す。
  const setRowError = useCallback((msg: string | null) => {
    setReorderError(msg);
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const target = computeMoveTarget(flatItems, activeId, String(over.id));
    if (target === null) return;

    // Issue #44 (optimistic UI): drop 即時に local 並び替えを反映して
    // server の round-trip 待ちを隠す。失敗時は props.todos に戻す (= null) で
    // rollback、成功時は router.refresh() で server 値と同期 → 自然に optimistic
    // クリア (props.todos !== prevTodosRef の分岐)。
    const optimistic = applyMoveOptimistic(
      effectiveTodos,
      activeId,
      target.bucket,
      target.position,
    );
    setOptimisticTodos(optimistic);
    setReorderError(null);

    startReorderTransition(async () => {
      try {
        const r = await moveTodo(activeId, target.bucket, target.position);
        if (r.ok) {
          router.refresh();
        } else {
          setOptimisticTodos(null);
          setReorderError(r.error ?? "並び替えに失敗しました");
        }
      } catch (e) {
        setOptimisticTodos(null);
        console.error("moveTodo threw", redactClientError(e));
        setReorderError("並び替えに失敗しました");
      }
    });
  }

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
        className="flex items-baseline justify-between pb-2 mb-2 flex-wrap gap-2"
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
            ToDo · 時間バケット
          </span>
          <span className="sk-mono">
            <span aria-hidden style={{ color: "var(--color-accent)" }}>
              ★
            </span>{" "}
            = 大事な 3 つ
          </span>
        </div>
        {/* Issue #46 新方針: ToDo セクション内の日付タブ */}
        {(prevDayDate || nextDayDate) && (
          <div
            className="flex items-center gap-1"
            role="tablist"
            aria-label="表示する日"
          >
            {prevDayDate && (
              <button
                type="button"
                role="tab"
                aria-selected={isViewingPrev}
                onClick={() => setViewDate(prevDayDate)}
                className="sk-chip"
                style={{
                  background: isViewingPrev
                    ? "var(--color-ink)"
                    : "var(--color-bg)",
                  color: isViewingPrev
                    ? "var(--color-bg)"
                    : "var(--color-ink-3)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono), monospace",
                  cursor: "pointer",
                }}
              >
                前日
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={isViewingToday}
              onClick={() => setViewDate(todayDate)}
              className="sk-chip"
              style={{
                background: isViewingToday
                  ? "var(--color-ink)"
                  : "var(--color-bg)",
                color: isViewingToday
                  ? "var(--color-bg)"
                  : "var(--color-ink-3)",
                fontSize: 11,
                fontFamily: "var(--font-mono), monospace",
                cursor: "pointer",
              }}
            >
              今日
            </button>
            {nextDayDate && (
              <button
                type="button"
                role="tab"
                aria-selected={!isViewingToday && !isViewingPrev}
                onClick={() => setViewDate(nextDayDate)}
                className="sk-chip"
                style={{
                  background:
                    !isViewingToday && !isViewingPrev
                      ? "var(--color-ink)"
                      : "var(--color-bg)",
                  color:
                    !isViewingToday && !isViewingPrev
                      ? "var(--color-bg)"
                      : "var(--color-ink-3)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono), monospace",
                  cursor: "pointer",
                }}
              >
                翌日
              </button>
            )}
          </div>
        )}
      </div>

      {/* 朝の引き継ぎ提案 (今日表示時のみ) */}
      {isViewingToday && carryProposal.length > 0 && (
        <CarryProposalCard
          proposals={carryProposal}
          todayDate={todayDate}
        />
      )}

      {/* 並び替えエラー (Issue #44) */}
      {reorderError && (
        <p
          role="alert"
          className="sk-mono mb-2"
          style={{ color: "var(--color-warn)" }}
        >
          {reorderError}
        </p>
      )}

      {/* バケットごとのリスト。全 bucket を 1 つの DndContext + SortableContext で
          包み、bucket 跨ぎ drag も同じ context 内で扱う (Issue #44)。 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
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
                  <span
                    className="sk-mono"
                    style={{ color: "var(--color-ink-4)" }}
                  >
                    · {bDone} / {items.length}
                  </span>
                </div>
                <div>
                  {items.map((t) => (
                    <TodoListRow
                      key={t.id}
                      todo={t}
                      // carry "→明日" は今日表示時のみ意味があるので、別日表示中は出さない
                      showCarryAction={isViewingToday && showCarryAction}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      onOptimisticDelete={applyOptimisticDelete}
                      onOptimisticBucketChange={applyOptimisticBucketChange}
                      onRevertOptimistic={revertOptimistic}
                      onSetRowError={setRowError}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </SortableContext>
      </DndContext>

      <TodoAddRow
        todayDate={viewDate}
        timeOfDay={timeOfDay}
        onOptimisticCreate={applyOptimisticCreate}
        onRevertOptimistic={revertOptimistic}
      />

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
          ≡ をドラッグで並び替え
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
  showCarryAction,
  openMenuId,
  setOpenMenuId,
  onOptimisticDelete,
  onOptimisticBucketChange,
  onRevertOptimistic,
  onSetRowError,
}: {
  todo: TodoRow;
  showCarryAction: boolean;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  onOptimisticDelete: (id: string) => void;
  onOptimisticBucketChange: (id: string, newBucket: TodoBucket) => void;
  onRevertOptimistic: () => void;
  /** 削除 / bucket 変更で行が remount されると local error state が消えるので、
   *  親に lift して banner で表示する。 */
  onSetRowError: (msg: string | null) => void;
}) {
  // Issue #44: useSortable で row を drag 対象に。listeners は handle ≡ にのみ付け、
  // 行本体は通常の checkbox/編集操作のまま。
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
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
  // Issue #40: テキスト/バケットのインライン編集。
  // text は楽観 UI (currentText を即時更新、失敗時 rollback) で、行が動かない。
  // bucket は非楽観 (refresh で行が新セクションに移動するので一旦待つ)。
  const [currentText, setCurrentText] = useState(todo.text);
  const [prevText, setPrevText] = useState(todo.text);
  if (todo.text !== prevText) {
    setPrevText(todo.text);
    setCurrentText(todo.text);
  }
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftText, setDraftText] = useState(todo.text);
  const [isEditingBucket, setIsEditingBucket] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const refresh = useCallback(() => router.refresh(), [router]);

  // 編集モードに入ったら input にフォーカスを当てて選択
  useEffect(() => {
    if (isEditingText) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditingText]);

  function startEditingText() {
    // PR #45 review: isPending ガードは撤去。row 共有の useTransition を介して
    // 他操作 (toggle 等) の進行中に編集をブロックする経路だったため。
    setDraftText(currentText);
    setError(null);
    setIsEditingText(true);
  }

  function commitTextEdit() {
    const trimmed = draftText.trim().slice(0, 500);
    if (!trimmed || trimmed === currentText) {
      // 空 or 変更なし → 編集破棄
      setIsEditingText(false);
      setDraftText(currentText);
      return;
    }
    const previous = currentText;
    setCurrentText(trimmed);
    setIsEditingText(false);
    setError(null);
    startTransition(async () => {
      try {
        const r = await updateTodo(todo.id, { text: trimmed });
        if (r.ok) {
          refresh();
        } else {
          setCurrentText(previous);
          setError(r.error ?? "保存に失敗しました");
        }
      } catch (e) {
        setCurrentText(previous);
        console.error("updateTodo text threw", redactClientError(e));
        setError("保存に失敗しました");
      }
    });
  }

  function cancelTextEdit() {
    setIsEditingText(false);
    setDraftText(currentText);
  }

  function handleTextKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // IME 確定の Enter で誤 submit しない (TodoAddRow と同じパターン)
    if (
      e.nativeEvent.isComposing ||
      (e as unknown as { keyCode: number }).keyCode === 229
    ) {
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commitTextEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTextEdit();
    }
  }

  function commitBucketEdit(newBucket: TodoBucket) {
    setIsEditingBucket(false);
    if (newBucket === todo.bucket) return;
    onSetRowError(null);
    // 楽観 UI: 即座に新 bucket の末尾に動かしておく。失敗時 revert。
    onOptimisticBucketChange(todo.id, newBucket);
    startTransition(async () => {
      try {
        const r = await updateTodo(todo.id, { bucket: newBucket });
        if (r.ok) {
          refresh();
        } else {
          onRevertOptimistic();
          // 行が remount するので親のエラー banner に出す
          onSetRowError(r.error ?? "保存に失敗しました");
        }
      } catch (e) {
        onRevertOptimistic();
        console.error("updateTodo bucket threw", redactClientError(e));
        onSetRowError("保存に失敗しました");
      }
    });
  }

  function handleToggle() {
    // PR #45 review: isPending ガード撤去。連続 toggle は server 側で順序処理され
    // 最終的に last write wins + refresh で UI 同期。実用上競合は発生しない。
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
        console.error("toggleTodoDone threw", redactClientError(e));
        setError("操作に失敗しました");
      }
    });
  }

  // Issue #44: ↑↓ ボタンはハンドル drag に一本化されたため削除。
  // reorderTodo server action / RPC は残してあるが UI からは呼ばない。

  function handleCarry() {
    // PR #45 review: isPending ガード撤去。carry の二重 click は server 側の
    // 部分 UNIQUE (todos_unique_carry_idem_idx) が 23505 で重複 INSERT を弾き、
    // tryInsertWithPosition が carryDuplicate=true として冪等成功を返す。
    setError(null);
    startTransition(async () => {
      try {
        const r = await carryTodoToTomorrow(todo.id);
        if (r.ok) refresh();
        else setError(r.error ?? "引き継ぎに失敗しました");
      } catch (e) {
        console.error("carryTodoToTomorrow threw", redactClientError(e));
        setError("引き継ぎに失敗しました");
      }
    });
  }

  function handleDelete() {
    // PR #45 review: isPending ガード撤去。confirm 確認はそのまま残すので
    // 暴発リスクは低い。連続削除は 2 回目が「対象 ToDo が見つかりません」エラーで
    // 自然に fail (= 同じ row を 2 回 delete することは起きない構造)。
    if (!window.confirm("このタスクを削除しますか？")) return;
    onSetRowError(null);
    // 楽観 UI: 即座に行を消す。失敗で revert。
    onOptimisticDelete(todo.id);
    startTransition(async () => {
      try {
        const r = await deleteTodo(todo.id);
        if (r.ok) refresh();
        else {
          onRevertOptimistic();
          // 行が remount するので親のエラー banner に出す
          onSetRowError(r.error ?? "削除に失敗しました");
        }
      } catch (e) {
        onRevertOptimistic();
        console.error("deleteTodo threw", redactClientError(e));
        onSetRowError("削除に失敗しました");
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-busy={isPending}
      className="grid items-center gap-2 py-2"
      style={{
        ...sortableStyle,
        gridTemplateColumns: "auto 1fr auto",
        padding: todo.important ? "10px 4px" : "7px 4px",
        borderBottom: "1px dashed var(--color-line-soft)",
        // PR #45 review: 楽観 UI で表示は既に確定済みなので server 通信中の
        // dim (`isPending ? 0.6 : 1`) は誤解の元 (= まだ未確定に見える)。
        // sortableStyle.opacity (drag 中 0.5) だけ尊重し、isPending 由来の
        // dim は外す。button の disabled は二重 submit 防止のため残す。
        opacity: sortableStyle.opacity ?? 1,
      }}
    >
      {/* 左: checkbox + 重要マーク + テキスト (タップで編集モードへ; Issue #40)。
          label でテキストまで包まないのは、テキストをタップしたときに
          checkbox トグルでなく編集モードに入るようにするため。
          checkbox は aria-label で本文を読み上げてもらう。 */}
      <div
        className="flex items-center gap-2 min-w-0"
        style={{ gridColumn: "1 / span 2" }}
      >
        {/* checkbox 単体 (h-4 w-4) は 16x16 でタッチターゲットが小さいので、
            label でラップして周囲も hit 領域にする。label には文字を入れず、
            input に aria-label でアクセシブル名を付ける (label は装飾用)。
            sk-tap-target で coarse pointer 時 min-height 44px。
            テキスト tap で編集モードに入る挙動は別の button が担うので、
            この label には text/onClick を載せない (toggle 専用)。 */}
        <label
          htmlFor={inputId}
          className="sk-tap-target flex items-center justify-center cursor-pointer flex-shrink-0"
          style={{ minWidth: 44, padding: "0 4px" }}
        >
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={handleToggle}
            // PR #45 review: disabled={isPending} を外す。browser の disabled
            // ネイティブ styling (半透明グレー) が「処理中=未確定」に見えるため。
            // 同時に handleToggle 側の isPending ガードも撤去 → 連続クリック OK。
            aria-label={`完了: ${currentText}`}
            className="h-4 w-4 cursor-pointer rounded-sm"
            style={{
              borderColor: "var(--color-ink-2)",
              accentColor: "var(--color-accent)",
            }}
          />
        </label>
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
        {isEditingText ? (
          <input
            ref={editInputRef}
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={handleTextKeyDown}
            onBlur={commitTextEdit}
            // PR #45 review: disabled は外す (gray-out 回避)。
            // commit は setIsEditingText(false) で input 自体が消えるので
            // 二重 commit のリスクはほぼ無い。
            maxLength={500}
            aria-label="タスク本文を編集"
            // 編集中の input も coarse pointer で 44px hit area を確保
            className="sk-tap-target flex-1 min-w-0"
            style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: todo.important ? 17 : 15,
              fontWeight: todo.important ? 700 : 400,
              color: "var(--color-ink)",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--color-line)",
              outline: "none",
              padding: "2px 0",
              lineHeight: 1.4,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={startEditingText}
            // PR #45 review: disabled は外す (gray-out 回避)。連続編集 OK
            // (server 側で last write wins、refresh で UI 同期)。
            // aria-label に重要フラグも含める (button に aria-label を付けると
            // 子要素の sr-only がアクセシブル名計算から除外されるため;
            // PR #41 round 3 Copilot review)。
            aria-label={
              todo.important
                ? `重要なタスク: ${currentText} を編集`
                : `${currentText} を編集`
            }
            // sk-tap-target: coarse pointer で min-height 44px を確保 (WCAG 2.5.5)
            // text-left + min-w-0 truncate で行内に収める。
            className="sk-tap-target min-w-0 truncate text-left"
            style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: todo.important ? 17 : 15,
              fontWeight: todo.important ? 700 : 400,
              color: checked ? "var(--color-ink-3)" : "var(--color-ink)",
              textDecoration: checked ? "line-through" : "none",
              textDecorationThickness: "1px",
              lineHeight: 1.4,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "text",
              flex: 1,
            }}
          >
            {/* 重要フラグは aria-label に含まれるので、ここでは視覚的な
                テキストのみ表示 (sr-only での重複読み上げを避ける)。 */}
            {currentText}
          </button>
        )}
      </div>

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
        {/* 時刻 or バケット chip。Issue #40: bucket chip をタップで select に
            切り替わり、変更で updateTodo (bucket) → refresh。
            time が set されているときは HH:MM 表示で、編集 UI は出さない
            (時刻編集は別 Issue)。 */}
        {todo.time ? (
          <span
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
            <span className="sr-only">予定時刻: </span>
            {todo.time}
          </span>
        ) : isEditingBucket ? (
          <select
            autoFocus
            defaultValue={todo.bucket}
            onChange={(e) => commitBucketEdit(e.target.value as TodoBucket)}
            onBlur={() => setIsEditingBucket(false)}
            disabled={isPending}
            aria-label={`${currentText} の時間帯を選択`}
            // sk-chip で coarse pointer 時 44x44 タップターゲット確保
            className="sk-chip"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              color: "var(--color-ink)",
              background: "var(--color-bg)",
              cursor: "pointer",
            }}
          >
            {TODO_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {TODO_BUCKET_LABEL[b]}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => !isPending && setIsEditingBucket(true)}
            disabled={isPending}
            aria-label={`${currentText} の時間帯を変更 (現在: ${TODO_BUCKET_LABEL[todo.bucket]})`}
            // sk-chip クラスで coarse pointer 時 44x44 タップターゲット確保 (WCAG 2.5.5)
            className="sk-chip"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              background: "var(--color-bg)",
              cursor: "pointer",
            }}
          >
            <span className="sr-only">時間帯: </span>
            {TODO_BUCKET_LABEL[todo.bucket]}
          </button>
        )}
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
        {/* Issue #44: ハンドル ≡ (タッチ/マウスで掴んでドラッグ、キーボードでも操作可)。
            attributes + listeners はハンドル単独に付けることで、行本体タップは
            編集モードのまま守られる (タップ誤操作防止)。 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={isPending}
          aria-label={`「${currentText}」をドラッグして並び替え`}
          className="sk-tap-target"
          style={{
            minWidth: 32,
            padding: "8px 6px",
            background: "transparent",
            color: "var(--color-ink-3)",
            border: "none",
            borderRadius: 6,
            cursor: isDragging ? "grabbing" : "grab",
            fontSize: 18,
            fontFamily: "var(--font-mono), monospace",
            touchAction: "none",
            lineHeight: 1,
          }}
        >
          ≡
        </button>
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
        aria-label={`「${todo.text}」の操作`}
        aria-haspopup="true"
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
        // Round 9 review: role="menu"/"menuitem" は矢印キー/ロービング tabindex
        // 等のメニュー用キーボード挙動を含意するが現状は単純なクリック+Tab 操作
        // しか実装していない。ARIA セマンティクス不整合を避けるため、シンプルな
        // ポップオーバー (role 無しの div + 通常 button) として扱う。
        // aria-label でグループ名を提供。Esc / 外側クリックで閉じる挙動は維持。
        <div
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

/** timeOfDay → 同日内で「今やる」のに近いバケットを返す。
 *  「今が午前」なら午前、「昼」なら午後、「夜」なら夜。「未指定」は午前。
 *  (team review 2 周目 P1: bucket デフォが forenoon 固定で時間帯と乖離) */
function defaultBucketFromTimeOfDay(
  timeOfDay: "morning" | "day" | "evening",
): TodoBucket {
  if (timeOfDay === "morning") return "morning";
  if (timeOfDay === "evening") return "night";
  return "afternoon";
}

function TodoAddRow({
  todayDate,
  timeOfDay,
  onOptimisticCreate,
  onRevertOptimistic,
}: {
  todayDate: string;
  timeOfDay: "morning" | "day" | "evening";
  onOptimisticCreate: (todo: TodoRow) => void;
  onRevertOptimistic: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [bucket, setBucket] = useState<TodoBucket>(() =>
    defaultBucketFromTimeOfDay(timeOfDay),
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // form field の id (Round 9 review followup: Chrome DevTools の
  // "form field should have an id or name attribute" 警告対策)。
  const textInputId = useId();
  const bucketSelectId = useId();

  function submit() {
    if (!text.trim() || isPending) return;
    setError(null);
    const trimmed = text.trim();
    // 楽観 UI: client 側で UUID を生成して即座に行を追加 (PR #45 review)。
    // server には同じ id で INSERT → refresh で自然に同期 (id 一致なので重複しない)。
    const newId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const optimisticTodo: TodoRow = {
      id: newId,
      target_date: todayDate,
      text: trimmed,
      bucket,
      time: null,
      position: 999999, // server で振り直されるまでの一時的に末尾相当の値
      done: false,
      important: false,
      carry_from_date: null,
      carry_from_todo_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    onOptimisticCreate(optimisticTodo);
    setText("");
    // 連続追加 UX: 入力欄に focus 維持
    requestAnimationFrame(() => inputRef.current?.focus());

    startTransition(async () => {
      try {
        const r = await createTodo({
          id: newId,
          text: trimmed,
          targetDate: todayDate,
          bucket,
        });
        if (r.ok) {
          router.refresh();
        } else {
          onRevertOptimistic();
          setError(r.error ?? "追加に失敗しました");
        }
      } catch (e) {
        onRevertOptimistic();
        console.error("createTodo threw", redactClientError(e));
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
        id={textInputId}
        name="new-todo-text"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        // PR #45 review: disabled は外す (gray-out 回避)。
        // 楽観 UI ですでに行が追加されているので連続入力可。submit 内に
        // `if (!text.trim() || isPending) return;` の guard あり。
        placeholder="タスクを追加..."
        aria-label="タスクの内容"
        autoComplete="off"
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
        id={bucketSelectId}
        name="new-todo-bucket"
        value={bucket}
        onChange={(e) => setBucket(e.target.value as TodoBucket)}
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
        console.error("acceptCarryProposal threw", redactClientError(e));
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
