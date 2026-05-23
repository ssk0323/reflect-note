import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderRitualButtons } from "./HeaderRitualButtons";

describe("HeaderRitualButtons", () => {
  it("4 つのリンク (朝/夜/週/月) が並ぶ", () => {
    render(
      <HeaderRitualButtons
        rituals={[
          { kind: "morning", done: false, active: true, href: "/flows/morning" },
          { kind: "evening", done: false, active: false, href: "/flows/night" },
          { kind: "weekReview", done: false, active: false, href: "/flows/weeklyReview" },
          { kind: "monthReview", done: false, active: false, href: "/flows/monthlyReview" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /朝のセットアップ/ })).toHaveAttribute(
      "href",
      "/flows/morning",
    );
    expect(screen.getByRole("link", { name: /夜のリフレクション/ })).toHaveAttribute(
      "href",
      "/flows/night",
    );
    expect(screen.getByRole("link", { name: /週の振り返り/ })).toHaveAttribute(
      "href",
      "/flows/weeklyReview",
    );
    expect(screen.getByRole("link", { name: /月の振り返り/ })).toHaveAttribute(
      "href",
      "/flows/monthlyReview",
    );
  });

  it("active のボタンは「今やる時間です」が aria に入る", () => {
    render(
      <HeaderRitualButtons
        rituals={[
          { kind: "morning", done: false, active: true, href: "/flows/morning" },
        ]}
      />,
    );
    expect(
      screen.getByLabelText(/朝のセットアップ.*今やる時間です/),
    ).toBeInTheDocument();
  });

  it("done のボタンは「完了済」が aria に入り、編集 href を持つ", () => {
    render(
      <HeaderRitualButtons
        rituals={[
          {
            kind: "morning",
            done: true,
            active: false,
            doneTime: "07:12",
            href: "/flows/morning?edit=abc",
          },
        ]}
      />,
    );
    const link = screen.getByLabelText(/朝のセットアップ.*完了済/);
    expect(link).toHaveAttribute("href", "/flows/morning?edit=abc");
  });
});
