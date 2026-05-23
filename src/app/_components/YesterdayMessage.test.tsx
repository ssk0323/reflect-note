import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YesterdayMessage } from "./YesterdayMessage";

describe("YesterdayMessage", () => {
  it("メッセージがあるときは引用符で囲って表示し、全文リンクを出す", () => {
    render(
      <YesterdayMessage
        message="完璧じゃなくていいので、まず10分だけ始めよう。"
        meta="5/20 23:14"
        href="/flows/night?edit=abc"
      />,
    );
    expect(
      screen.getByText(/完璧じゃなくていいので/),
    ).toBeInTheDocument();
    expect(screen.getByText(/5\/20 23:14/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /昨日のあなたから/ });
    expect(link).toHaveAttribute("href", "/flows/night?edit=abc");
  });

  it("メッセージが空のときは破線で「ここに表示されます」と案内", () => {
    render(<YesterdayMessage message="" meta="" href="/history" />);
    expect(
      screen.getByText(/ここに表示されます/),
    ).toBeInTheDocument();
    // 空状態のときは Link を出さない (案内のみ)
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("空白だけのメッセージも空扱い", () => {
    render(<YesterdayMessage message="   " meta="5/20" href="/x" />);
    expect(
      screen.getByText(/ここに表示されます/),
    ).toBeInTheDocument();
  });
});
