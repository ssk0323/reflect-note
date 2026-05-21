import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GoalCard, type CheckableField } from "./GoalCard";
import type { RecordRow } from "@/lib/records/types";

vi.mock("@/app/actions", () => ({
  toggleCheck: vi.fn().mockResolvedValue({ ok: true, checked: true }),
}));

function record(
  answers: Record<string, string>,
  checks: Record<string, boolean> = {},
): RecordRow {
  return {
    id: "rec-1",
    type: "morning",
    answers,
    checks,
    created_at: "2026-05-20T03:00:00Z",
    updated_at: "2026-05-20T03:00:00Z",
  };
}

const checkableFields: CheckableField[] = [
  { key: "goal", kind: "goal", label: "目標" },
  { key: "task1", kind: "task", label: "タスク 1" },
  { key: "task2", kind: "task", label: "タスク 2" },
  { key: "task3", kind: "task", label: "タスク 3" },
];

const baseProps = {
  title: "今日の目標",
  emoji: "🌅",
  checkableFields,
  emptyMessage: "今日の目標はまだ設定されていません。",
  emptyCta: { href: "/flows/morning", label: "朝のセットアップを始める" },
};

describe("GoalCard", () => {
  it("shows the empty CTA when record is null", () => {
    render(<GoalCard {...baseProps} record={null} />);
    expect(
      screen.getByText("今日の目標はまだ設定されていません。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "朝のセットアップを始める" }),
    ).toHaveAttribute("href", "/flows/morning");
  });

  it("separates goal and task into distinct sections", () => {
    const r = record({
      goal: "勉強する",
      task1: "本を読む",
      task2: "英語の動画",
      task3: "ジムに行く",
    });
    render(<GoalCard {...baseProps} record={r} />);

    // 目標セクションには goal が 1 件、タスクセクションには task が 3 件
    const goalSection = screen.getByRole("region", { name: "目標" });
    const taskSection = screen.getByRole("region", { name: "タスク" });

    expect(within(goalSection).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(goalSection).getByText("勉強する")).toBeInTheDocument();

    expect(within(taskSection).getAllByRole("checkbox")).toHaveLength(3);
    expect(within(taskSection).getByText("本を読む")).toBeInTheDocument();
    expect(within(taskSection).getByText("英語の動画")).toBeInTheDocument();
    expect(within(taskSection).getByText("ジムに行く")).toBeInTheDocument();
  });

  it("renders sublabels (タスク 1 等) above each task", () => {
    const r = record({ task1: "本を読む" });
    render(<GoalCard {...baseProps} record={r} />);
    expect(screen.getByText("タスク 1")).toBeInTheDocument();
  });

  it("hides the goal section when no goal is filled", () => {
    const r = record({ task1: "本を読む" });
    render(<GoalCard {...baseProps} record={r} />);
    expect(screen.queryByRole("region", { name: "目標" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "タスク" })).toBeInTheDocument();
  });

  it("hides the task section when no tasks are filled", () => {
    const r = record({ goal: "勉強する" });
    render(<GoalCard {...baseProps} record={r} />);
    expect(screen.getByRole("region", { name: "目標" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "タスク" })).not.toBeInTheDocument();
  });

  it("renders only fields with non-empty text within their section", () => {
    const r = record({
      goal: "勉強する",
      task1: "本を読む",
      task2: "",
      task3: "ジムに行く",
    });
    render(<GoalCard {...baseProps} record={r} />);
    const taskSection = screen.getByRole("region", { name: "タスク" });
    // task2 は空なので出ない
    expect(within(taskSection).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(taskSection).queryByText("タスク 2")).not.toBeInTheDocument();
  });

  it("reflects checked state from record.checks", () => {
    const r = record(
      { goal: "勉強する", task1: "本を読む" },
      { goal: true, task1: false },
    );
    render(<GoalCard {...baseProps} record={r} />);

    expect(screen.getByRole("checkbox", { name: /勉強する/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /本を読む/ })).not.toBeChecked();
  });

  it("shows the 'all empty' message when record exists but no values entered", () => {
    const r = record({ goal: "", task1: "" });
    render(<GoalCard {...baseProps} record={r} />);
    expect(screen.getByText("目標とタスクが未入力です。")).toBeInTheDocument();
  });

  it("shows a prominent edit button (in header) when editHref is provided and record exists", () => {
    const r = record({ goal: "勉強する" });
    render(
      <GoalCard {...baseProps} record={r} editHref="/flows/morning?edit=rec-1" />,
    );
    // aria-label でアクセシブルなボタンとして検出できる
    const link = screen.getByRole("link", { name: /今日の目標を編集する/ });
    expect(link).toHaveAttribute("href", "/flows/morning?edit=rec-1");
    expect(link).toHaveTextContent("編集");
  });

  it("does NOT show the edit button when there is no record", () => {
    render(<GoalCard {...baseProps} record={null} />);
    expect(
      screen.queryByRole("link", { name: /編集する/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(
      <GoalCard
        {...baseProps}
        record={null}
        subtitle="2026年5月21日(木)"
      />,
    );
    expect(screen.getByText("2026年5月21日(木)")).toBeInTheDocument();
  });
});
