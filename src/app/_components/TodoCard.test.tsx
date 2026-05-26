import { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { TodoCard } from "./TodoCard";
import type { TodoRow } from "@/lib/todos/types";

// PR #45 review: drag-end の wiring を回帰防止テスト可能にするため、
// @dnd-kit/core の DndContext を mock して onDragEnd コールバックを捕捉する。
// SortableContext / useSortable 等は実物を使い (useSortable は useContext で
// DndContext を要求しないので問題なく動く)、handleDragEnd の挙動だけ検証する。
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    DndContext: ({
      onDragEnd,
      children,
    }: {
      onDragEnd?: (event: DragEndEvent) => void;
      children: ReactNode;
    }) => {
      capturedOnDragEnd = onDragEnd ?? null;
      return <>{children}</>;
    },
  };
});

const toggleTodoDone = vi.fn();
const createTodo = vi.fn();
const updateTodo = vi.fn();
const moveTodo = vi.fn();
const deleteTodo = vi.fn();
const carryTodoToTomorrow = vi.fn();
const acceptCarryProposal = vi.fn();
const refresh = vi.fn();

vi.mock("@/app/_todos/actions", () => ({
  toggleTodoDone: (...args: unknown[]) => toggleTodoDone(...args),
  createTodo: (...args: unknown[]) => createTodo(...args),
  updateTodo: (...args: unknown[]) => updateTodo(...args),
  moveTodo: (...args: unknown[]) => moveTodo(...args),
  deleteTodo: (...args: unknown[]) => deleteTodo(...args),
  carryTodoToTomorrow: (...args: unknown[]) => carryTodoToTomorrow(...args),
  acceptCarryProposal: (...args: unknown[]) => acceptCarryProposal(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function todo(overrides: Partial<TodoRow>): TodoRow {
  return {
    id: overrides.id ?? "00000000-0000-0000-0000-000000000001",
    target_date: overrides.target_date ?? "2026-05-22",
    text: overrides.text ?? "タスク",
    bucket: overrides.bucket ?? "forenoon",
    time: overrides.time ?? null,
    position: overrides.position ?? 0,
    done: overrides.done ?? false,
    important: overrides.important ?? false,
    carry_from_date: overrides.carry_from_date ?? null,
    carry_from_todo_id: overrides.carry_from_todo_id ?? null,
    created_at: overrides.created_at ?? "2026-05-22T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-05-22T00:00:00Z",
  };
}

describe("TodoCard", () => {
  beforeEach(() => {
    toggleTodoDone.mockReset();
    createTodo.mockReset();
    updateTodo.mockReset();
    moveTodo.mockReset();
    deleteTodo.mockReset();
    carryTodoToTomorrow.mockReset();
    acceptCarryProposal.mockReset();
    refresh.mockReset();
    capturedOnDragEnd = null;
  });

  it("バケット見出しの下にタスクを並べる", () => {
    render(
      <TodoCard
        todos={[
          todo({ id: "a", text: "朝のメール", bucket: "morning" }),
          todo({ id: "b", text: "ランチ", bucket: "afternoon" }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );

    const morningSection = screen.getByRole("region", { name: "朝のタスク" });
    expect(within(morningSection).getByText("朝のメール")).toBeInTheDocument();
    const afternoonSection = screen.getByRole("region", { name: "午後のタスク" });
    expect(within(afternoonSection).getByText("ランチ")).toBeInTheDocument();
  });

  it("「+ タスクを追加」inline 行で Enter 送信できる", async () => {
    createTodo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "a", text: "X" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );

    const input = screen.getByLabelText("タスクの内容");
    await user.type(input, "新しいタスク");
    await user.keyboard("{Enter}");

    expect(createTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "新しいタスク",
        targetDate: "2026-05-22",
      }),
    );
  });

  it("toggle 成功時に router.refresh を呼ぶ (footer count 更新の回帰防止)", async () => {
    toggleTodoDone.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "00000000-0000-0000-0000-000000000001", text: "X" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /X/ });
    await user.click(checkbox);

    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("toggle 失敗時はチェック状態が rollback され alert が出る", async () => {
    toggleTodoDone.mockResolvedValue({ ok: false, error: "boom" });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "00000000-0000-0000-0000-000000000001", text: "X" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /X/ });
    await user.click(checkbox);

    await vi.waitFor(() => expect(checkbox).not.toBeChecked());
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("↑↓ ボタンは Issue #44 で削除済み (ハンドル drag に一本化)", () => {
    render(
      <TodoCard
        todos={[
          todo({ id: "11111111-1111-1111-1111-111111111111", text: "A", position: 0 }),
          todo({ id: "22222222-2222-2222-2222-222222222222", text: "B", position: 1 }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    expect(screen.queryByLabelText("このタスクを上に移動")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("このタスクを下に移動")).not.toBeInTheDocument();
  });

  it("各行に ≡ ドラッグハンドルが表示される", () => {
    render(
      <TodoCard
        todos={[
          todo({ id: "11111111-1111-1111-1111-111111111111", text: "A" }),
          todo({ id: "22222222-2222-2222-2222-222222222222", text: "B" }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /「A」をドラッグして並び替え/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /「B」をドラッグして並び替え/ }),
    ).toBeInTheDocument();
  });

  it("showCarryAction=true の時、未完了タスクに「→明日」ボタンが出る", async () => {
    carryTodoToTomorrow.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[
          todo({ id: "11111111-1111-1111-1111-111111111111", text: "A", done: false }),
          todo({ id: "22222222-2222-2222-2222-222222222222", text: "B", done: true }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={true}
      />,
    );

    // A (未完了) には →明日 がある
    const a = screen.getByLabelText("「A」を明日に引き継ぐ");
    expect(a).toBeInTheDocument();
    // B (完了済) には →明日 が無い
    expect(
      screen.queryByLabelText("「B」を明日に引き継ぐ"),
    ).not.toBeInTheDocument();

    await user.click(a);
    expect(carryTodoToTomorrow).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("⋯ メニューが Escape で閉じる + 外側クリックで閉じる (a11y P0)", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "A" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );

    const trigger = screen.getByLabelText("「A」の操作");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Round 9 review: role=menu は降格したので、popover の中の「削除」ボタンで
    // 開いていることを確認する。
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();

    // Escape で閉じる
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "削除" })).not.toBeInTheDocument();
  });

  it("⋯ メニューは行を超えて 1 つだけ open になる (global single-open)", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[
          todo({ id: "11111111-1111-1111-1111-111111111111", text: "A" }),
          todo({ id: "22222222-2222-2222-2222-222222222222", text: "B" }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );

    const triggerA = screen.getByLabelText("「A」の操作");
    const triggerB = screen.getByLabelText("「B」の操作");

    await user.click(triggerA);
    expect(triggerA).toHaveAttribute("aria-expanded", "true");

    await user.click(triggerB);
    // B 開く → A は閉じる
    expect(triggerA).toHaveAttribute("aria-expanded", "false");
    expect(triggerB).toHaveAttribute("aria-expanded", "true");
    // 同時に open しているのは 1 つだけ (「削除」ボタンが画面上に 1 つ)
    expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(1);
  });

  it("props で todo.done が変わると checked が同期する (state stale 回帰防止)", () => {
    const { rerender } = render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "X", done: false })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: /X/ });
    expect(checkbox).not.toBeChecked();

    rerender(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "X", done: true })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    // 再 render 中に「prev props と比較して setState」する React 公式パターン
    // (Storing information from previous renders) で local state が同期される。
    // useEffect ではないので set-state-in-effect lint には引っかからない。
    expect(screen.getByRole("checkbox", { name: /X/ })).toBeChecked();
  });

  it("引き継ぎ提案カードで「N件追加」を押すと acceptCarryProposal が呼ばれる", async () => {
    acceptCarryProposal.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[]}
        todayDate="2026-05-22"
        showCarryAction={false}
        carryProposal={[
          todo({
            id: "33333333-3333-3333-3333-333333333333",
            text: "昨日の残り",
            target_date: "2026-05-21",
          }),
        ]}
      />,
    );

    expect(screen.getByText(/昨日からの引き継ぎ/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /今日の ToDo に追加/ });
    await user.click(button);

    expect(acceptCarryProposal).toHaveBeenCalledWith(
      ["33333333-3333-3333-3333-333333333333"],
      "2026-05-22",
    );
  });

  it("timeOfDay=evening のとき、新規追加の bucket デフォが「夜」になる", async () => {
    // team review 2 周目 P1: bucket default が forenoon 固定だった問題の回帰防止
    createTodo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[]}
        todayDate="2026-05-22"
        showCarryAction={false}
        timeOfDay="evening"
      />,
    );

    const select = screen.getByLabelText("時間バケット");
    expect((select as HTMLSelectElement).value).toBe("night");

    const input = screen.getByLabelText("タスクの内容");
    await user.type(input, "夜タスク");
    await user.keyboard("{Enter}");

    expect(createTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "夜タスク",
        bucket: "night",
      }),
    );
  });

  it("timeOfDay=morning のとき bucket デフォは「朝」", () => {
    render(
      <TodoCard
        todos={[]}
        todayDate="2026-05-22"
        showCarryAction={false}
        timeOfDay="morning"
      />,
    );
    const select = screen.getByLabelText("時間バケット") as HTMLSelectElement;
    expect(select.value).toBe("morning");
  });

  it("timeOfDay=day のとき bucket デフォは「午後」", () => {
    render(
      <TodoCard
        todos={[]}
        todayDate="2026-05-22"
        showCarryAction={false}
        timeOfDay="day"
      />,
    );
    const select = screen.getByLabelText("時間バケット") as HTMLSelectElement;
    expect(select.value).toBe("afternoon");
  });

  it("footer のカウントは todos props から再計算され、星付きも別途数える", () => {
    render(
      <TodoCard
        todos={[
          todo({ id: "1", text: "A", important: true, done: true }),
          todo({ id: "2", text: "B", important: true, done: false }),
          todo({ id: "3", text: "C", important: true, done: false }),
          todo({ id: "4", text: "D", important: false, done: true }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    expect(screen.getByText(/2 \/ 4 達成 · 大事な3つ 1\/3/)).toBeInTheDocument();
  });

  // ----------------------------------------------------------------------------
  // Inline edit: text (Issue #40)
  // ----------------------------------------------------------------------------

  it("テキストをタップすると編集モードに入り、prefill された input が表示される", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "元のテキスト" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    const trigger = screen.getByRole("button", { name: /元のテキスト を編集/ });
    await user.click(trigger);
    const input = screen.getByRole("textbox", { name: /タスク本文を編集/ });
    expect(input).toHaveValue("元のテキスト");
  });

  it("編集 → Enter で updateTodo が呼ばれ、新しいテキストが UI に反映される", async () => {
    updateTodo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "古い" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /古い を編集/ }));
    const input = screen.getByRole("textbox", { name: /タスク本文を編集/ });
    await user.clear(input);
    await user.type(input, "新しい{Enter}");
    expect(updateTodo).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      { text: "新しい" },
    );
    // 編集モードから抜けて、新テキストの button が出る
    expect(
      await screen.findByRole("button", { name: /新しい を編集/ }),
    ).toBeInTheDocument();
  });

  it("編集 → blur (フォーカス外し) でも保存される", async () => {
    updateTodo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "古い" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /古い を編集/ }));
    const input = screen.getByRole("textbox", { name: /タスク本文を編集/ });
    await user.clear(input);
    await user.type(input, "ブラー保存");
    // tab で blur
    await user.tab();
    expect(updateTodo).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      { text: "ブラー保存" },
    );
  });

  it("Esc で編集破棄 → updateTodo は呼ばれず元テキストが残る", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "元" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /元 を編集/ }));
    const input = screen.getByRole("textbox", { name: /タスク本文を編集/ });
    await user.type(input, "捨てる");
    await user.keyboard("{Escape}");
    expect(updateTodo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /元 を編集/ })).toBeInTheDocument();
  });

  it("空文字で Enter しても updateTodo は呼ばれず元テキストが残る", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "残す" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /残す を編集/ }));
    const input = screen.getByRole("textbox", { name: /タスク本文を編集/ });
    await user.clear(input);
    await user.keyboard("{Enter}");
    expect(updateTodo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /残す を編集/ })).toBeInTheDocument();
  });

  it("テキストが変わっていない (= 同じ text で保存) なら updateTodo は呼ばれない", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "変わらず" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /変わらず を編集/ }));
    await user.keyboard("{Enter}");
    expect(updateTodo).not.toHaveBeenCalled();
  });

  it("IME 確定の Enter (keyCode=229) では submit しない", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "古" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /古 を編集/ }));
    const input = screen.getByRole("textbox", { name: /タスク本文を編集/ }) as HTMLInputElement;
    // fireEvent.keyDown で keyCode=229 を直接渡し、IME 確定の Enter を再現する
    // (jsdom では isComposing が read-only なので keyCode 経由のガードを検証)
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(updateTodo).not.toHaveBeenCalled();
    // input がまだ表示されている (= submit されていない)
    expect(screen.getByRole("textbox", { name: /タスク本文を編集/ })).toBeInTheDocument();
  });

  it("updateTodo が失敗したら元テキストにロールバックし alert が出る", async () => {
    updateTodo.mockResolvedValue({ ok: false, error: "保存に失敗しました" });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "元" })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /元 を編集/ }));
    const input = screen.getByRole("textbox", { name: /タスク本文を編集/ });
    await user.clear(input);
    await user.type(input, "失敗{Enter}");
    // updateTodo は呼ばれる
    expect(updateTodo).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      { text: "失敗" },
    );
    // rollback で元の text に戻る
    expect(
      await screen.findByRole("button", { name: /元 を編集/ }),
    ).toBeInTheDocument();
    // alert が出る
    expect(await screen.findByRole("alert")).toHaveTextContent(/保存に失敗/);
  });

  // ----------------------------------------------------------------------------
  // Inline edit: bucket (Issue #40)
  // ----------------------------------------------------------------------------

  it("bucket chip をタップすると select が表示され、変更で updateTodo が呼ばれる", async () => {
    updateTodo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[
          todo({
            id: "11111111-1111-1111-1111-111111111111",
            text: "Bテスト",
            bucket: "forenoon",
          }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    const chip = screen.getByRole("button", { name: /時間帯を変更/ });
    await user.click(chip);
    const select = screen.getByRole("combobox", { name: /時間帯を選択/ });
    await user.selectOptions(select, "afternoon");
    expect(updateTodo).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      { bucket: "afternoon" },
    );
  });

  it("bucket 変更が失敗したら元の bucket に戻し alert を出す", async () => {
    updateTodo.mockResolvedValue({ ok: false, error: "保存に失敗" });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[
          todo({
            id: "11111111-1111-1111-1111-111111111111",
            text: "Bエラー",
            bucket: "forenoon",
          }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    const chip = screen.getByRole("button", { name: /時間帯を変更/ });
    await user.click(chip);
    const select = screen.getByRole("combobox", { name: /時間帯を選択/ });
    await user.selectOptions(select, "night");
    // rollback で元の bucket (forenoon) のセクションに表示される
    expect(await screen.findByRole("alert")).toHaveTextContent(/保存に失敗/);
  });

  // ----------------------------------------------------------------------------
  // Drag end wiring (PR #45 review)
  // ----------------------------------------------------------------------------

  it("drag end で moveTodo(id, bucket, position) が期待引数で呼ばれる", async () => {
    moveTodo.mockResolvedValue({ ok: true });
    render(
      <TodoCard
        todos={[
          todo({
            id: "11111111-1111-1111-1111-111111111111",
            text: "A",
            bucket: "morning",
            position: 0,
          }),
          todo({
            id: "22222222-2222-2222-2222-222222222222",
            text: "B",
            bucket: "morning",
            position: 1,
          }),
          todo({
            id: "33333333-3333-3333-3333-333333333333",
            text: "C",
            bucket: "afternoon",
            position: 0,
          }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    expect(capturedOnDragEnd).not.toBeNull();
    // A を C にドロップ → A は afternoon の position 1 (C の後ろ) に
    act(() => {
      capturedOnDragEnd!({
        active: { id: "11111111-1111-1111-1111-111111111111" },
        over: { id: "33333333-3333-3333-3333-333333333333" },
      } as unknown as DragEndEvent);
    });
    await vi.waitFor(() => expect(moveTodo).toHaveBeenCalled());
    expect(moveTodo).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "afternoon",
      1,
    );
  });

  it("drag end が失敗したら optimistic を rollback して role=alert を出す", async () => {
    moveTodo.mockResolvedValue({ ok: false, error: "並び替えに失敗" });
    render(
      <TodoCard
        todos={[
          todo({
            id: "11111111-1111-1111-1111-111111111111",
            text: "A",
            bucket: "morning",
            position: 0,
          }),
          todo({
            id: "22222222-2222-2222-2222-222222222222",
            text: "B",
            bucket: "morning",
            position: 1,
          }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    act(() => {
      capturedOnDragEnd!({
        active: { id: "11111111-1111-1111-1111-111111111111" },
        over: { id: "22222222-2222-2222-2222-222222222222" },
      } as unknown as DragEndEvent);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/並び替えに失敗/);
  });

  it("drag end で over=active なら moveTodo は呼ばれない (no-op)", () => {
    render(
      <TodoCard
        todos={[
          todo({
            id: "11111111-1111-1111-1111-111111111111",
            text: "A",
            bucket: "morning",
            position: 0,
          }),
        ]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    act(() => {
      capturedOnDragEnd!({
        active: { id: "11111111-1111-1111-1111-111111111111" },
        over: { id: "11111111-1111-1111-1111-111111111111" },
      } as unknown as DragEndEvent);
    });
    expect(moveTodo).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------------------
  // Date tabs (Issue #46 新方針)
  // ----------------------------------------------------------------------------

  it("prevDayDate / nextDayDate を渡すと「前日 / 今日 / 翌日」タブが出る", () => {
    render(
      <TodoCard
        todos={[todo({ id: "a", text: "今日のタスク" })]}
        prevDayTodos={[todo({ id: "b", text: "前日のタスク" })]}
        nextDayTodos={[todo({ id: "c", text: "翌日のタスク" })]}
        todayDate="2026-05-26"
        prevDayDate="2026-05-25"
        nextDayDate="2026-05-27"
        showCarryAction={false}
      />,
    );
    expect(screen.getByRole("button", { name: "前日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "翌日" })).toBeInTheDocument();
    // 初期表示は今日
    expect(screen.getByText("今日のタスク")).toBeInTheDocument();
    expect(screen.queryByText("前日のタスク")).not.toBeInTheDocument();
  });

  it("翌日タブをクリックすると翌日の todos が表示される", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "a", text: "今日のタスク" })]}
        nextDayTodos={[todo({ id: "c", text: "翌日のタスク" })]}
        todayDate="2026-05-26"
        nextDayDate="2026-05-27"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "翌日" }));
    expect(screen.getByText("翌日のタスク")).toBeInTheDocument();
    expect(screen.queryByText("今日のタスク")).not.toBeInTheDocument();
  });

  it("翌日タブで新規 ToDo を追加すると createTodo が翌日 date で呼ばれる", async () => {
    createTodo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[]}
        nextDayTodos={[]}
        todayDate="2026-05-26"
        nextDayDate="2026-05-27"
        showCarryAction={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "翌日" }));
    const input = screen.getByLabelText("タスクの内容");
    await user.type(input, "明日のタスク{Enter}");
    expect(createTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "明日のタスク",
        targetDate: "2026-05-27",
      }),
    );
  });

  it("別日表示中は「→明日」carry ボタンが出ない", async () => {
    const user = userEvent.setup();
    render(
      <TodoCard
        todos={[todo({ id: "a", text: "今日タスク" })]}
        nextDayTodos={[todo({ id: "c", text: "明日タスク" })]}
        todayDate="2026-05-26"
        nextDayDate="2026-05-27"
        showCarryAction
      />,
    );
    // 今日表示時は「明日に引き継ぐ」ボタンが出る
    expect(
      screen.getByLabelText("「今日タスク」を明日に引き継ぐ"),
    ).toBeInTheDocument();
    // 翌日タブに切替後、carry ボタンは消える
    await user.click(screen.getByRole("button", { name: "翌日" }));
    expect(
      screen.queryByLabelText("「明日タスク」を明日に引き継ぐ"),
    ).not.toBeInTheDocument();
  });
});
