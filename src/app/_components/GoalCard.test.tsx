import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoalCard } from "./GoalCard";
import type { RecordRow } from "@/lib/records/types";

vi.mock("@/app/actions", () => ({
  toggleCheck: vi.fn().mockResolvedValue({ ok: true, checked: true }),
}));

function record(answers: Record<string, string>, checks: Record<string, boolean> = {}): RecordRow {
  return {
    id: "rec-1",
    type: "morning",
    answers,
    checks,
    created_at: "2026-05-20T03:00:00Z",
    updated_at: "2026-05-20T03:00:00Z",
  };
}

describe("GoalCard", () => {
  const props = {
    title: "今日の目標",
    emoji: "🌅",
    checkableFields: [
      { key: "goal", fallbackLabel: "今日の目標" },
      { key: "task1", fallbackLabel: "タスク 1" },
      { key: "task2", fallbackLabel: "タスク 2" },
      { key: "task3", fallbackLabel: "タスク 3" },
    ],
    emptyMessage: "今日の目標はまだ設定されていません。",
    emptyCta: { href: "/flows/morning", label: "朝のセットアップを始める" },
  };

  it("shows the empty CTA when record is null", () => {
    render(<GoalCard {...props} record={null} />);
    expect(
      screen.getByText("今日の目標はまだ設定されていません。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "朝のセットアップを始める" }),
    ).toHaveAttribute("href", "/flows/morning");
  });

  it("renders only fields with non-empty text", () => {
    const r = record({
      goal: "勉強する",
      task1: "本を読む",
      task2: "",
      task3: "ジムに行く",
    });
    render(<GoalCard {...props} record={r} />);

    expect(screen.getByRole("checkbox", { name: /勉強する/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /本を読む/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /ジムに行く/ })).toBeInTheDocument();
    // task2 は空なので checkbox は出ない
    expect(screen.queryByText("タスク 2")).not.toBeInTheDocument();
  });

  it("reflects checked state from record.checks", () => {
    const r = record(
      { goal: "勉強する", task1: "本を読む" },
      { goal: true, task1: false },
    );
    render(<GoalCard {...props} record={r} />);

    expect(screen.getByRole("checkbox", { name: /勉強する/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /本を読む/ })).not.toBeChecked();
  });

  it("shows a 'all empty' message when record exists but no values entered", () => {
    const r = record({ goal: "", task1: "" });
    render(<GoalCard {...props} record={r} />);
    expect(screen.getByText("目標とタスクが未入力です。")).toBeInTheDocument();
  });

  it("shows the edit link when editHref is provided and record exists", () => {
    const r = record({ goal: "勉強する" });
    render(<GoalCard {...props} record={r} editHref="/flows/morning?edit=rec-1" />);
    expect(screen.getByRole("link", { name: /編集する/ })).toHaveAttribute(
      "href",
      "/flows/morning?edit=rec-1",
    );
  });
});
