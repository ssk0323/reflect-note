import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BadgesCard } from "./BadgesCard";
import type { Achievement } from "@/lib/records/achievements";

describe("BadgesCard", () => {
  it("shows empty state when there are no achievements", () => {
    render(<BadgesCard achievements={[]} />);
    expect(
      screen.getByText(
        "まだバッジはありません。週次・月次の入力を続けると獲得できます。",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error message when error is provided", () => {
    render(<BadgesCard achievements={[]} error="DB unreachable" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "バッジを読み込めませんでした",
    );
  });

  it("renders each achievement with its title and description", () => {
    const achievements: Achievement[] = [
      {
        code: "weekly_complete",
        title: "今週の入力コンプリート",
        description: "今週の目標設定と振り返りの両方を入力しました。",
      },
      {
        code: "monthly_count",
        title: "月間 20 回達成",
        description: "今月 20 件の記録を達成しました。",
      },
    ];

    render(<BadgesCard achievements={achievements} />);

    expect(screen.getByText("今週の入力コンプリート")).toBeInTheDocument();
    expect(screen.getByText("月間 20 回達成")).toBeInTheDocument();
    expect(
      screen.getByText("今月 20 件の記録を達成しました。"),
    ).toBeInTheDocument();
  });
});
