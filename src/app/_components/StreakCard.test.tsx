import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakCard } from "./StreakCard";

describe("StreakCard", () => {
  it("renders both morning and night streak counts", () => {
    render(
      <StreakCard
        morningStreak={{ current: 3, longest: 5, lastDate: "2026-05-20" }}
        nightStreak={{ current: 2, longest: 2, lastDate: "2026-05-19" }}
      />,
    );
    expect(screen.getByText("朝のセットアップ")).toBeInTheDocument();
    expect(screen.getByText("夜のリフレクション")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the longest streak when longer than current", () => {
    render(
      <StreakCard
        morningStreak={{ current: 1, longest: 10, lastDate: "2026-05-20" }}
        nightStreak={{ current: 0, longest: 0, lastDate: null }}
      />,
    );
    expect(screen.getByText("最長 10 日")).toBeInTheDocument();
  });

  it("hides the longest hint when equal to current", () => {
    render(
      <StreakCard
        morningStreak={{ current: 3, longest: 3, lastDate: "2026-05-20" }}
        nightStreak={{ current: 0, longest: 0, lastDate: null }}
      />,
    );
    expect(screen.queryByText(/最長/)).not.toBeInTheDocument();
  });
});
