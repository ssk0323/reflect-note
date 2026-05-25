import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GoalsStrip } from "./GoalsStrip";
import type { RecordRow } from "@/lib/records/types";

vi.mock("@/app/actions", () => ({
  toggleCheck: vi.fn().mockResolvedValue({ ok: true, checked: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function rec(
  overrides: Partial<RecordRow> & {
    answers?: Record<string, string>;
    checks?: Record<string, boolean>;
  } = {},
): RecordRow {
  return {
    id: overrides.id ?? "rec-1",
    type: overrides.type ?? "morning",
    answers: overrides.answers ?? {},
    checks: overrides.checks ?? {},
    target_date: overrides.target_date ?? null,
    created_at: overrides.created_at ?? "2026-05-21T03:00:00Z",
    updated_at: overrides.updated_at ?? "2026-05-21T03:00:00Z",
  };
}

const DEFAULT_LABELS = {
  todayLabel: "5/21(木)",
  weekRangeLabel: "5/19 → 5/25",
  weekRemainingLabel: "残り 3日",
  monthLabel: "2026年5月",
  monthRemainingLabel: "残り 10日",
};

describe("GoalsStrip / 今日カード", () => {
  it("今日 record が無いとき: 「朝のセットアップを始める」CTA を出す", () => {
    render(
      <GoalsStrip today={null} week={null} month={null} {...DEFAULT_LABELS} />,
    );
    expect(
      screen.getByRole("link", { name: /朝のセットアップを始める/ }),
    ).toHaveAttribute("href", "/flows/morning");
  });

  it("今日 record があるとき: goal / attention / task1-3 が表示される", () => {
    const today = rec({
      id: "today-1",
      answers: {
        goal: "研修資料の全体構成を固める",
        attention: "細部より、まず全体像",
        task1: "目次を作る",
        task2: "ワーク3問",
        task3: "確認事項まとめ",
      },
      checks: { task1: true },
    });
    render(
      <GoalsStrip today={today} week={null} month={null} {...DEFAULT_LABELS} />,
    );

    expect(screen.getByText("研修資料の全体構成を固める")).toBeInTheDocument();
    expect(screen.getByText(/細部より、まず全体像/)).toBeInTheDocument();
    expect(screen.getByText("目次を作る")).toBeInTheDocument();
    expect(screen.getByText("ワーク3問")).toBeInTheDocument();
    expect(screen.getByText("確認事項まとめ")).toBeInTheDocument();
    // 1 / 3 達成
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
    // 編集リンク
    expect(
      screen.getByRole("link", { name: /今日の目標を編集する/ }),
    ).toHaveAttribute("href", "/flows/morning?edit=today-1");
  });

  it("attention のみ未入力でも他は表示される", () => {
    const today = rec({
      id: "today-2",
      answers: {
        goal: "本を読む",
        task1: "10ページ",
      },
    });
    render(
      <GoalsStrip today={today} week={null} month={null} {...DEFAULT_LABELS} />,
    );
    expect(screen.getByText("本を読む")).toBeInTheDocument();
    expect(screen.getByText("10ページ")).toBeInTheDocument();
  });
});

describe("GoalsStrip / 週・月カード", () => {
  it("週 record があるとき: weekGoal / weekPriority1-3 が表示される", () => {
    const week = rec({
      id: "week-1",
      type: "weeklyGoal",
      answers: {
        weekGoal: "研修案件の山場",
        weekPriority1: "研修資料を完成",
        weekPriority2: "事前ワーク設計",
        weekPriority3: "本番リハ",
      },
      checks: { weekPriority1: true },
    });
    render(
      <GoalsStrip today={null} week={week} month={null} {...DEFAULT_LABELS} />,
    );

    expect(screen.getByText("研修案件の山場")).toBeInTheDocument();
    expect(screen.getByText("研修資料を完成")).toBeInTheDocument();
    expect(screen.getByText(/5\/19 → 5\/25/)).toBeInTheDocument();
  });

  it("週 record が無いとき: 「今週の目標を立てる」リンクを出す", () => {
    render(
      <GoalsStrip today={null} week={null} month={null} {...DEFAULT_LABELS} />,
    );
    const link = screen.getByRole("link", { name: /今週の目標を立てる/ });
    expect(link).toHaveAttribute("href", "/flows/weeklyGoal");
  });

  it("月 record があるとき: monthGoal が表示される", () => {
    const month = rec({
      id: "month-1",
      type: "monthlyGoal",
      answers: {
        monthGoal: "「教える」を仕組み化",
        monthPriority1: "教材テンプレ",
      },
    });
    render(
      <GoalsStrip today={null} week={null} month={month} {...DEFAULT_LABELS} />,
    );
    expect(screen.getByText("「教える」を仕組み化")).toBeInTheDocument();
    expect(screen.getByText("教材テンプレ")).toBeInTheDocument();
  });

  it("aria-label で「今日の目標」「region」を識別できる", () => {
    const today = rec({ answers: { goal: "X" } });
    render(
      <GoalsStrip today={today} week={null} month={null} {...DEFAULT_LABELS} />,
    );
    const article = screen.getByRole("article", { name: "今日の目標" });
    expect(within(article).getByText("X")).toBeInTheDocument();
  });
});
