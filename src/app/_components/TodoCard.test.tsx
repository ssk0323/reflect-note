import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoCard } from "./TodoCard";
import type { TodoRow } from "@/lib/todos/types";

const toggleTodoDone = vi.fn();
const createTodo = vi.fn();
const reorderTodo = vi.fn();
const deleteTodo = vi.fn();
const carryTodoToTomorrow = vi.fn();
const acceptCarryProposal = vi.fn();
const refresh = vi.fn();

vi.mock("@/app/_todos/actions", () => ({
  toggleTodoDone: (...args: unknown[]) => toggleTodoDone(...args),
  createTodo: (...args: unknown[]) => createTodo(...args),
  reorderTodo: (...args: unknown[]) => reorderTodo(...args),
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
    reorderTodo.mockReset();
    deleteTodo.mockReset();
    carryTodoToTomorrow.mockReset();
    acceptCarryProposal.mockReset();
    refresh.mockReset();
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

    const checkbox = screen.getByRole("checkbox", { name: "X" });
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

    const checkbox = screen.getByRole("checkbox", { name: "X" });
    await user.click(checkbox);

    await vi.waitFor(() => expect(checkbox).not.toBeChecked());
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("↑↓ ボタンで reorderTodo を呼ぶ (端では disabled)", async () => {
    reorderTodo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
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

    // A は先頭なので「上に移動」が disabled
    const aUp = screen.getAllByLabelText("このタスクを上に移動")[0];
    expect(aUp).toBeDisabled();

    // A の「下に移動」を押す
    const aDown = screen.getAllByLabelText("このタスクを下に移動")[0];
    await user.click(aDown);
    expect(reorderTodo).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "down",
    );
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
    const checkbox = screen.getByRole("checkbox", { name: "X" });
    expect(checkbox).not.toBeChecked();

    rerender(
      <TodoCard
        todos={[todo({ id: "11111111-1111-1111-1111-111111111111", text: "X", done: true })]}
        todayDate="2026-05-22"
        showCarryAction={false}
      />,
    );
    // 再 render 後、useEffect で local state が同期される
    expect(screen.getByRole("checkbox", { name: "X" })).toBeChecked();
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
});
