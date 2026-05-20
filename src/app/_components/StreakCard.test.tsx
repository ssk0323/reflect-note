import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakCard } from "./StreakCard";

describe("StreakCard", () => {
  it("renders both morning and night streak counts with accessible labels", () => {
    render(
      <StreakCard
        morningStreak={{ current: 3, longest: 5, lastDate: "2026-05-20" }}
        nightStreak={{ current: 2, longest: 2, lastDate: "2026-05-19" }}
      />,
    );
    expect(screen.getByText("朝のセットアップ")).toBeInTheDocument();
    expect(screen.getByText("夜のリフレクション")).toBeInTheDocument();
    // 「現在 3 日連続」を SR が連続して読めるよう aria-label が付いている
    expect(
      screen.getByLabelText(/朝のセットアップ: 現在 3 日連続/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/夜のリフレクション: 現在 2 日連続/),
    ).toBeInTheDocument();
  });

  it("shows the longest streak when longer than current", () => {
    render(
      <StreakCard
        morningStreak={{ current: 1, longest: 10, lastDate: "2026-05-20" }}
        nightStreak={{ current: 0, longest: 0, lastDate: null }}
      />,
    );
    expect(screen.getByLabelText("最長 10 日")).toBeInTheDocument();
  });

  it("hides the longest hint when equal to current", () => {
    render(
      <StreakCard
        morningStreak={{ current: 3, longest: 3, lastDate: "2026-05-20" }}
        nightStreak={{ current: 0, longest: 0, lastDate: null }}
      />,
    );
    expect(screen.queryByLabelText(/最長/)).not.toBeInTheDocument();
  });

  it("shows '途切れています' when current is 0 but longest > 0", () => {
    render(
      <StreakCard
        morningStreak={{ current: 0, longest: 5, lastDate: "2026-05-15" }}
        nightStreak={{ current: 0, longest: 0, lastDate: null }}
      />,
    );
    expect(screen.getByText("途切れています")).toBeInTheDocument();
    expect(
      screen.getByLabelText("朝のセットアップ: 途切れています"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("最長 5 日")).toBeInTheDocument();
  });

  it("shows '0 日連続' when both current and longest are 0", () => {
    render(
      <StreakCard
        morningStreak={{ current: 0, longest: 0, lastDate: null }}
        nightStreak={{ current: 0, longest: 0, lastDate: null }}
      />,
    );
    // 「途切れています」ではなく 0 日連続 (まだ一度も記録していない)
    expect(screen.queryByText("途切れています")).not.toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/現在 0 日連続/).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows an error message when error is provided", () => {
    render(
      <StreakCard
        morningStreak={{ current: 0, longest: 0, lastDate: null }}
        nightStreak={{ current: 0, longest: 0, lastDate: null }}
        error="DB unreachable"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ストリークを読み込めませんでした",
    );
    // ストリーク数値は出さない
    expect(screen.queryByText("朝のセットアップ")).not.toBeInTheDocument();
  });
});
