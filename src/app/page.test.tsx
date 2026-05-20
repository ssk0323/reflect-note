import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders the reflect-note label and tagline heading", () => {
    render(<Home />);
    expect(screen.getByText(/reflect-note/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /朝に整え、夜に振り返る/, level: 1 }),
    ).toBeInTheDocument();
  });

  it("shows links for all 6 flows", () => {
    render(<Home />);
    const expected: Array<[string, RegExp]> = [
      ["/flows/morning", /朝のセットアップ/],
      ["/flows/night", /夜のリフレクション/],
      ["/flows/weeklyGoal", /週の目標設定/],
      ["/flows/weeklyReview", /週の振り返り/],
      ["/flows/monthlyGoal", /月の目標設定/],
      ["/flows/monthlyReview", /月の振り返り/],
    ];

    for (const [href, name] of expected) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
    }
  });
});
