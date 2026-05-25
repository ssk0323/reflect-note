"use client";

import {
  Fragment,
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
  moveTodo,
  reorderTodo,
  toggleTodoDone,
  updateTodo,
} from "@/app/_todos/actions";

/** client 側で console.error する際に、ユーザー入力 text を含み得る Server Action
 *  の生 error をそのまま出さないようにする (team review 2 周目 P2)。
 *  name のみログし、Sentry 等の集約 SaaS 導入時に PII が漏れる経路を絶つ。 */
function redactClientError(e: unknown): { name: string } {
  if (e instanceof Error) return { name: e.name };
  return { name: typeof e };
}

type Props = {
  todos: TodoRow[];
  todayDate: string;
  showCarryAction: boolean;
  carryProposal?: TodoRow[];
  /** 「今は朝/昼/夜のどれか」を渡すと TodoAddRow の bucket デフォルトが連動する */
  timeOfDay?: "morning" | "day" | "evening";
};

export function TodoCard({
  todos,
  todayDate,
  showCarryAction,
  carryProposal = [],
  timeOfDay = "day",
}: Props) {
  const router = useRouter();
  const byBucket = groupByBucket(todos);

  // 達成集計はサーバから来た todos で常に再計算 (P2 toggle 後の集計未更新を解消)。
  const total = todos.length;
  const doneCount = todos.filter((t) => t.done).length;
  const starDone = todos.filter((t) => t.important && t.done).length;
  const starTotal = todos.filter((t) => t.important).length;

  // 1 行だけ menu を open にするための global close 機構 (a11y P0)。
  // 各 TodoListRow が menuToken を保持し、別 row が open になったら自分は閉じる。
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Issue #42: 並び替えタップモード。reorderingId が set されているとき、
  // 各 bucket に「ここに置く」slot を描画。slot タップで moveTodo を呼ぶ。
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [, startReorderTransition] = useTransition();

  // 移動中の todo の src 情報 (bucket × position)。slot 表示制御に使う。
  const reorderingSrc =
    reorderingId !== null
      ? todos.find((t) => t.id === reorderingId) ?? null
      : null;

  // Esc キーで並び替えキャンセル (a11y)
  useEffect(() => {
    if (reorderingId === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setReorderingId(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [reorderingId]);

  function handleStartReorder(id: string) {
    setReorderError(null);
    setReorderingId((current) => (current === id ? null : id));
  }

  function handleSlotClick(targetBucket: TodoBucket, targetPosition: number) {
    if (reorderingId === null) return;
    const movingId = reorderingId;
    setReorderingId(null);
    setReorderError(null);
    startReorderTransition(async () => {
      try {
        const r = await moveTodo(movingId, targetBucket, targetPosition);
        if (r.ok) {
          router.refresh();
        } else {
          setReorderError(r.error ?? "並び替えに失敗しました");
        }
      } catch (e) {
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

      {/* 並び替えエラー (Issue #42) */}
      {reorderError && (
        <p
          role="alert"
          className="sk-mono mb-2"
          style={{ color: "var(--color-warn)" }}
        >
          {reorderError}
        </p>
      )}

      {/* バケットごとのリスト。reordering 中は空 bucket も表示 (移動先候補のため)。 */}
      {TODO_BUCKETS.map((bucket) => {
        const items = byBucket[bucket];
        // reordering 中は空 bucket も移動先候補として表示する
        if (items.length === 0 && reorderingSrc === null) return null;
        const bDone = items.filter((t) => t.done).length;
        const slotsForBucket = computeSlots(bucket, items, reorderingSrc);
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
              {items.length > 0 && (
                <span className="sk-mono" style={{ color: "var(--color-ink-4)" }}>
                  · {bDone} / {items.length}
                </span>
              )}
            </div>
            <div>
              {/* slot at start of bucket (= 先頭) */}
              {slotsForBucket.find((s) => s.displayIdx === 0) && (
                <ReorderSlot
                  bucket={bucket}
                  bucketLabel={TODO_BUCKET_LABEL[bucket]}
                  displayIdx={0}
                  totalItems={items.length}
                  prevText={null}
                  nextText={items[0]?.text ?? null}
                  newPosition={
                    slotsForBucket.find((s) => s.displayIdx === 0)!.newPosition
                  }
                  onSelect={handleSlotClick}
                />
              )}
              {items.map((t, idx) => (
                <Fragment key={t.id}>
                  <TodoListRow
                    todo={t}
                    isFirst={idx === 0}
                    isLast={idx === items.length - 1}
                    showCarryAction={showCarryAction}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    isReordering={reorderingId === t.id}
                    reorderingActive={reorderingId !== null}
                    onToggleReorder={() => handleStartReorder(t.id)}
                  />
                  {/* slot after this row */}
                  {slotsForBucket.find((s) => s.displayIdx === idx + 1) && (
                    <ReorderSlot
                      bucket={bucket}
                      bucketLabel={TODO_BUCKET_LABEL[bucket]}
                      displayIdx={idx + 1}
                      totalItems={items.length}
                      prevText={t.text}
                      nextText={items[idx + 1]?.text ?? null}
                      newPosition={
                        slotsForBucket.find((s) => s.displayIdx === idx + 1)!
                          .newPosition
                      }
                      onSelect={handleSlotClick}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </section>
        );
      })}

      <TodoAddRow todayDate={todayDate} timeOfDay={timeOfDay} />

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

/** 並び替え中に各 bucket の有効な挿入 slot を計算する (Issue #42)。
 *  - src がこの bucket にある場合: src に隣接する 2 slot は no-op なので除外
 *  - src が別 bucket の場合: 全 slot 有効
 *  返り値: { displayIdx: 表示上の挿入位置 0..N, newPosition: moveTodo に渡す位置 }
 */
function computeSlots(
  bucket: TodoBucket,
  items: TodoRow[],
  src: TodoRow | null,
): { displayIdx: number; newPosition: number }[] {
  if (src === null) return [];
  const slots: { displayIdx: number; newPosition: number }[] = [];
  if (src.bucket === bucket) {
    // Same bucket: src の左右 (= src.position と src.position+1) を skip。
    // 「lifted view の position」を newPosition として返す。
    for (let i = 0; i <= items.length; i++) {
      if (i === src.position || i === src.position + 1) continue;
      slots.push({
        displayIdx: i,
        newPosition: i < src.position ? i : i - 1,
      });
    }
  } else {
    // Different bucket: 全 slot 有効、newPosition = displayIdx
    for (let i = 0; i <= items.length; i++) {
      slots.push({ displayIdx: i, newPosition: i });
    }
  }
  return slots;
}

function ReorderSlot({
  bucket,
  bucketLabel,
  displayIdx,
  totalItems,
  prevText,
  nextText,
  newPosition,
  onSelect,
}: {
  bucket: TodoBucket;
  bucketLabel: string;
  displayIdx: number;
  totalItems: number;
  prevText: string | null;
  nextText: string | null;
  newPosition: number;
  onSelect: (bucket: TodoBucket, position: number) => void;
}) {
  // aria-label: 「ここに置く」を必ず含み、bucket と位置の文脈も付与する。
  const label = (() => {
    if (totalItems === 0) return `${bucketLabel}にここに置く`;
    if (displayIdx === 0) return `${bucketLabel}の先頭にここに置く`;
    if (displayIdx === totalItems) return `${bucketLabel}の末尾にここに置く`;
    return `${bucketLabel}: 「${prevText}」と「${nextText}」の間にここに置く`;
  })();
  return (
    <button
      type="button"
      onClick={() => onSelect(bucket, newPosition)}
      aria-label={label}
      // sk-tap-target: coarse pointer で 44px hit area
      className="sk-tap-target w-full flex items-center justify-center"
      style={{
        height: 32,
        margin: "2px 0",
        border: "1px dashed var(--color-line)",
        borderRadius: 6,
        background: "transparent",
        color: "var(--color-ink-3)",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 11,
        letterSpacing: "0.06em",
        cursor: "pointer",
      }}
    >
      ↓ ここに置く ↓
    </button>
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
  isReordering,
  reorderingActive,
  onToggleReorder,
}: {
  todo: TodoRow;
  isFirst: boolean;
  isLast: boolean;
  showCarryAction: boolean;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  isReordering: boolean;
  reorderingActive: boolean;
  onToggleReorder: () => void;
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
    if (isPending) return;
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
    setError(null);
    startTransition(async () => {
      try {
        const r = await updateTodo(todo.id, { bucket: newBucket });
        if (r.ok) refresh();
        else setError(r.error ?? "保存に失敗しました");
      } catch (e) {
        console.error("updateTodo bucket threw", redactClientError(e));
        setError("保存に失敗しました");
      }
    });
  }

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
        console.error("toggleTodoDone threw", redactClientError(e));
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
        console.error("reorderTodo threw", redactClientError(e));
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
        console.error("carryTodoToTomorrow threw", redactClientError(e));
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
        console.error("deleteTodo threw", redactClientError(e));
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
            disabled={isPending}
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
            disabled={isPending}
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
            disabled={isPending}
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
        <ReorderButtons
          onUp={() => handleReorder("up")}
          onDown={() => handleReorder("down")}
          isFirst={isFirst}
          isLast={isLast}
          disabled={isPending || reorderingActive}
          taskName={todo.text}
        />
        {/* Issue #42: 任意位置移動の trigger。
            isReordering 中は「キャンセル」、それ以外は「開始」として動く。 */}
        <button
          type="button"
          onClick={onToggleReorder}
          disabled={isPending || (reorderingActive && !isReordering)}
          aria-label={
            isReordering
              ? `「${todo.text}」の並び替えをキャンセル`
              : `「${todo.text}」の並び替えを開始`
          }
          aria-pressed={isReordering}
          // sk-tap-target で coarse pointer 時 44px hit area
          className="sk-tap-target"
          style={{
            minWidth: 32,
            padding: "8px 6px",
            background: isReordering
              ? "var(--color-accent)"
              : "transparent",
            color: isReordering
              ? "var(--color-bg)"
              : "var(--color-ink-3)",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 16,
            fontFamily: "var(--font-mono), monospace",
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
          isPending={isPending || reorderingActive}
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
}: {
  todayDate: string;
  timeOfDay: "morning" | "day" | "evening";
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
        disabled={isPending}
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
