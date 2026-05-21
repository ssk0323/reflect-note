import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryClient } from "./HistoryClient";
import type { RecordRow } from "@/lib/records/types";

const deleteRecord = vi.fn();
const refresh = vi.fn();

vi.mock("./actions", () => ({
  deleteRecord: (...args: unknown[]) => deleteRecord(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function record(
  id: string,
  type: RecordRow["type"],
  createdAt: string,
  answers: RecordRow["answers"] = {},
): RecordRow {
  return {
    id,
    type,
    answers,
    checks: {},
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("HistoryClient", () => {
  beforeEach(() => {
    deleteRecord.mockReset();
    refresh.mockReset();
  });

  it("renders a back-to-home link", () => {
    render(<HistoryClient records={[]} />);
    const link = screen.getByRole("link", { name: /ホームへ戻る/ });
    expect(link).toHaveAttribute("href", "/");
  });

  it("shows an empty state when there are no records", () => {
    render(<HistoryClient records={[]} />);
    expect(screen.getByText(/まだ記録がありません/)).toBeInTheDocument();
  });

  it("groups records by JST date", () => {
    // すべて JST 日中の時刻に統一して UTC ↔ JST 越境を避ける
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T03:00:00Z", { goal: "目標A" }), // JST 12:00 5/20
      record("b", "night", "2026-05-20T11:00:00Z", { done: "夜A" }), // JST 20:00 5/20
      record("c", "morning", "2026-05-19T05:00:00Z", { goal: "目標B" }), // JST 14:00 5/19
    ];

    render(<HistoryClient records={records} />);

    // 日付セクションが 2 つある
    const sections = screen.getAllByRole("region", { name: /2026年5月/ });
    expect(sections).toHaveLength(2);

    // 2026-05-20 のセクションに 2 件、2026-05-19 のセクションに 1 件
    expect(within(sections[0]).getAllByRole("article")).toHaveLength(2);
    expect(within(sections[1]).getAllByRole("article")).toHaveLength(1);
  });

  it("filters by record type", async () => {
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T08:00:00Z", { goal: "目標A" }),
      record("b", "night", "2026-05-20T22:00:00Z", { done: "夜A" }),
    ];

    render(<HistoryClient records={records} />);

    // 初期状態: 「すべて」で 2 件
    expect(screen.getAllByRole("article")).toHaveLength(2);

    // 「夜」フィルタへ (aria-pressed button)
    const nightButton = screen.getByRole("button", { name: "夜" });
    expect(nightButton).toHaveAttribute("aria-pressed", "false");
    await user.click(nightButton);
    expect(nightButton).toHaveAttribute("aria-pressed", "true");

    const filtered = screen.getAllByRole("article");
    expect(filtered).toHaveLength(1);
    expect(within(filtered[0]).getByText("夜のリフレクション")).toBeInTheDocument();
  });

  it("renders all question titles and answers in the accordion details", async () => {
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T08:00:00Z", {
        goal: "GOAL_VALUE",
        task1: "T1_VALUE",
        attention: "ATTN_VALUE",
      }),
    ];

    render(<HistoryClient records={records} />);

    // details 要素は初期状態で閉じている
    const details = screen.getByText("内容を見る").closest("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);

    // クリックで開く
    await user.click(screen.getByText("内容を見る"));
    expect(details?.open).toBe(true);

    // 質問タイトルとそれぞれの answer が DOM に存在
    expect(screen.getByText("今日の目標は？")).toBeInTheDocument();
    expect(screen.getByText("今日やるタスク 1つ目は？")).toBeInTheDocument();
    expect(screen.getByText("今日、気をつけたいことは？")).toBeInTheDocument();
    expect(screen.getByText("T1_VALUE")).toBeInTheDocument();
    expect(screen.getByText("ATTN_VALUE")).toBeInTheDocument();
  });

  it("renders an edit link to /flows/<type>?edit=<id>", () => {
    const records: RecordRow[] = [
      record("abc", "morning", "2026-05-20T03:00:00Z"),
    ];
    render(<HistoryClient records={records} />);

    const link = screen.getByRole("link", { name: "編集する" });
    expect(link).toHaveAttribute("href", "/flows/morning?edit=abc");
  });

  it("calls deleteRecord after confirm and refreshes the router", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteRecord.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("abc", "morning", "2026-05-20T03:00:00Z"),
    ];

    render(<HistoryClient records={records} />);
    await user.click(screen.getByRole("button", { name: "この記録を削除" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteRecord).toHaveBeenCalledWith("abc");
    // 削除成功後に router.refresh() で一覧を再取得することを検証
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  it("does NOT call deleteRecord when confirm is cancelled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("abc", "morning", "2026-05-20T03:00:00Z"),
    ];

    render(<HistoryClient records={records} />);
    await user.click(screen.getByRole("button", { name: "この記録を削除" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
