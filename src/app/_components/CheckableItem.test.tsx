import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckableItem } from "./CheckableItem";

const toggleCheck = vi.fn();

vi.mock("@/app/actions", () => ({
  toggleCheck: (...args: unknown[]) => toggleCheck(...args),
}));

describe("CheckableItem", () => {
  beforeEach(() => {
    toggleCheck.mockReset();
  });

  it("renders the text and checkbox in the unchecked state", () => {
    render(
      <CheckableItem
        recordId="abc"
        fieldKey="goal"
        text="今日の目標"
        initialChecked={false}
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: /今日の目標/ });
    expect(checkbox).not.toBeChecked();
  });

  it("renders the checked state from initialChecked", () => {
    render(
      <CheckableItem
        recordId="abc"
        fieldKey="task1"
        text="タスク1"
        initialChecked={true}
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: /タスク1/ });
    expect(checkbox).toBeChecked();
  });

  it("calls toggleCheck on click and updates the UI optimistically", async () => {
    toggleCheck.mockResolvedValue({ ok: true, checked: true });
    const user = userEvent.setup();
    render(
      <CheckableItem
        recordId="abc"
        fieldKey="goal"
        text="今日の目標"
        initialChecked={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(toggleCheck).toHaveBeenCalledWith("abc", "goal");
    expect(checkbox).toBeChecked();
  });

  it("reverts the optimistic state and shows error if the server action fails", async () => {
    toggleCheck.mockResolvedValue({ ok: false, error: "boom" });
    const user = userEvent.setup();
    render(
      <CheckableItem
        recordId="abc"
        fieldKey="goal"
        text="今日の目標"
        initialChecked={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    // 失敗したので unchecked に戻り、エラーメッセージが出る
    expect(checkbox).not.toBeChecked();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("ignores rapid double-clicks while pending", async () => {
    // 1 回目は never resolve させて pending 状態を維持
    let resolveFirst: (v: unknown) => void = () => {};
    toggleCheck.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );
    const user = userEvent.setup();
    render(
      <CheckableItem
        recordId="abc"
        fieldKey="goal"
        text="今日の目標"
        initialChecked={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    // 連打 (まだ resolve していない)
    await user.click(checkbox);
    await user.click(checkbox);

    // toggleCheck は 1 回しか呼ばれていない
    expect(toggleCheck).toHaveBeenCalledTimes(1);
    // クリーンアップ
    resolveFirst({ ok: true, checked: true });
  });
});
