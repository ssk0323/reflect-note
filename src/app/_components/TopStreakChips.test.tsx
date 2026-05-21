import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopStreakChips } from "./TopStreakChips";
import type { Streak } from "@/lib/records/streak";
import type { Achievement } from "@/lib/records/achievements";

const streak = (current: number, longest: number = current): Streak => ({
  current,
  longest,
  lastDate: null,
});

describe("TopStreakChips", () => {
  it("朝と夜のストリーク数を表示する", () => {
    render(
      <TopStreakChips
        morningStreak={streak(12)}
        nightStreak={streak(8)}
        achievements={[]}
      />,
    );
    expect(screen.getByText("朝 12日連続")).toBeInTheDocument();
    expect(screen.getByText("夜 8日連続")).toBeInTheDocument();
  });

  it("バッジが 1 つ以上あるときだけバッジチップを出す", () => {
    const achievements: Achievement[] = [
      { code: "weekly_complete", title: "週完了", description: "" },
      { code: "monthly_count", title: "月20件", description: "" },
    ];
    render(
      <TopStreakChips
        morningStreak={streak(0)}
        nightStreak={streak(0)}
        achievements={achievements}
      />,
    );
    expect(screen.getByText("バッジ 2")).toBeInTheDocument();
  });

  it("バッジが 0 件のときはバッジチップを出さない", () => {
    render(
      <TopStreakChips
        morningStreak={streak(0)}
        nightStreak={streak(0)}
        achievements={[]}
      />,
    );
    expect(screen.queryByText(/バッジ /)).not.toBeInTheDocument();
  });

  it("error が渡されたときはエラーメッセージを role=alert で出す", () => {
    render(
      <TopStreakChips
        morningStreak={streak(0)}
        nightStreak={streak(0)}
        achievements={[]}
        error="DB error"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /記録の読み込みに失敗しました/,
    );
  });
});
