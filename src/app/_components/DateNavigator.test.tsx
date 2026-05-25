import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateNavigator } from "./DateNavigator";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("DateNavigator (Issue #46)", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("今日 / 明日 / カレンダー の 3 つを表示する", () => {
    render(
      <DateNavigator
        viewDate="2026-05-26"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    expect(screen.getByRole("link", { name: /今日/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /明日/ })).toBeInTheDocument();
    expect(screen.getByLabelText("日付を選んで表示")).toBeInTheDocument();
  });

  it("viewDate=today なら「今日」が aria-current=page", () => {
    render(
      <DateNavigator
        viewDate="2026-05-26"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    expect(screen.getByRole("link", { name: /今日/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /明日/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("viewDate=tomorrow なら「明日」が aria-current=page", () => {
    render(
      <DateNavigator
        viewDate="2026-05-27"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    expect(screen.getByRole("link", { name: /明日/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("「今日」のリンクは / にナビゲートする (?date= 無し)", () => {
    render(
      <DateNavigator
        viewDate="2026-05-27"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    const link = screen.getByRole("link", { name: /今日/ });
    expect(link).toHaveAttribute("href", "/");
  });

  it("「明日」のリンクは ?date=tomorrow に", () => {
    render(
      <DateNavigator
        viewDate="2026-05-26"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    const link = screen.getByRole("link", { name: /明日/ });
    expect(link).toHaveAttribute("href", "/?date=2026-05-27");
  });

  it("日付ピッカーで別日選択 → /?date=YYYY-MM-DD で navigate", () => {
    render(
      <DateNavigator
        viewDate="2026-05-26"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    const input = screen.getByLabelText("日付を選んで表示") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-06-01" } });
    expect(push).toHaveBeenCalledWith("/?date=2026-06-01");
  });

  it("日付ピッカーで today を選択 → / で navigate (?date= 無しの形)", () => {
    render(
      <DateNavigator
        viewDate="2026-05-27"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    const input = screen.getByLabelText("日付を選んで表示") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-05-26" } });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("不正な日付フォーマットでは navigate しない", () => {
    render(
      <DateNavigator
        viewDate="2026-05-26"
        todayDate="2026-05-26"
        tomorrowDate="2026-05-27"
      />,
    );
    const input = screen.getByLabelText("日付を選んで表示") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "invalid" } });
    expect(push).not.toHaveBeenCalled();
  });
});
