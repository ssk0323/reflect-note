import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroCard } from "./HeroCard";
import type { CheckableField } from "./GoalCard";
import type { RecordRow } from "@/lib/records/types";
import type { Flow } from "@/lib/flows";

vi.mock("@/app/actions", () => ({
  toggleCheck: vi.fn().mockResolvedValue({ ok: true, checked: true }),
}));

const morningCheckables: CheckableField[] = [
  { key: "goal", kind: "goal", label: "目標" },
  { key: "task1", kind: "task", label: "タスク 1" },
];

const flowLabels: Record<Flow["type"], string> = {
  morning: "朝のセットアップ",
  night: "夜の振り返り",
  weeklyGoal: "週の目標",
  weeklyReview: "週の振り返り",
  monthlyGoal: "月の目標",
  monthlyReview: "月の振り返り",
};

function record(answers: Record<string, string>, checks: Record<string, boolean> = {}): RecordRow {
  return {
    id: "rec-1",
    type: "morning",
    answers,
    checks,
    created_at: "2026-05-21T03:00:00Z",
    updated_at: "2026-05-21T03:00:00Z",
  };
}

describe("HeroCard", () => {
  it("morning モードでは朝の CTA と sun glyph を出す", () => {
    render(
      <HeroCard
        mode="morning"
        todayRecord={null}
        morningCheckables={morningCheckables}
        flowLabels={flowLabels}
      />,
    );
    const link = screen.getByRole("link", { name: /朝のセットアップを始める/ });
    expect(link).toHaveAttribute("href", "/flows/morning");
  });

  it("night モードでは夜の CTA を出す", () => {
    render(
      <HeroCard
        mode="night"
        todayRecord={null}
        morningCheckables={morningCheckables}
        flowLabels={flowLabels}
      />,
    );
    const link = screen.getByRole("link", { name: /夜のリフレクションを始める/ });
    expect(link).toHaveAttribute("href", "/flows/night");
  });

  it("done モードでは「おつかれさま」メッセージを出す", () => {
    render(
      <HeroCard
        mode="done"
        todayRecord={null}
        morningCheckables={morningCheckables}
        flowLabels={flowLabels}
      />,
    );
    expect(screen.getByText(/おつかれさま/)).toBeInTheDocument();
  });

  it("「他を書く」チップとして 6 つのフローへのリンクを出す", () => {
    render(
      <HeroCard
        mode="morning"
        todayRecord={null}
        morningCheckables={morningCheckables}
        flowLabels={flowLabels}
      />,
    );
    expect(screen.getByRole("link", { name: "朝のセットアップ" })).toHaveAttribute("href", "/flows/morning");
    expect(screen.getByRole("link", { name: "夜の振り返り" })).toHaveAttribute("href", "/flows/night");
    expect(screen.getByRole("link", { name: "週の目標" })).toHaveAttribute("href", "/flows/weeklyGoal");
    expect(screen.getByRole("link", { name: "週の振り返り" })).toHaveAttribute("href", "/flows/weeklyReview");
    expect(screen.getByRole("link", { name: "月の目標" })).toHaveAttribute("href", "/flows/monthlyGoal");
    expect(screen.getByRole("link", { name: "月の振り返り" })).toHaveAttribute("href", "/flows/monthlyReview");
  });

  it("todayRecord があるときは「今日の目標」進捗 mini を出す", () => {
    const r = record({ goal: "勉強する", task1: "本を読む" }, { goal: true, task1: false });
    render(
      <HeroCard
        mode="night"
        todayRecord={r}
        morningCheckables={morningCheckables}
        flowLabels={flowLabels}
      />,
    );
    expect(screen.getByText("勉強する")).toBeInTheDocument();
    expect(screen.getByText("本を読む")).toBeInTheDocument();
    // 達成カウント + 編集リンク
    expect(screen.getByRole("link", { name: /今日の目標を編集する/ })).toHaveAttribute(
      "href",
      "/flows/morning?edit=rec-1",
    );
    expect(screen.getByText(/1 \/ 2 達成/)).toBeInTheDocument();
  });

  it("todayRecord が null のときは進捗 mini を出さない", () => {
    render(
      <HeroCard
        mode="morning"
        todayRecord={null}
        morningCheckables={morningCheckables}
        flowLabels={flowLabels}
      />,
    );
    expect(screen.queryByText(/今日の目標 · 朝に書いた/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /今日の目標を編集する/ }),
    ).not.toBeInTheDocument();
  });
});
