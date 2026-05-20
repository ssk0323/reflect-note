import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryClient } from "./HistoryClient";
import type { RecordRow } from "@/lib/records/types";

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
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("HistoryClient", () => {
  it("shows an empty state when there are no records", () => {
    render(<HistoryClient records={[]} />);
    expect(screen.getByText(/まだ記録がありません/)).toBeInTheDocument();
  });

  it("groups records by created_at date", () => {
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T08:00:00Z", { goal: "目標A" }),
      record("b", "night", "2026-05-20T22:00:00Z", { done: "夜A" }),
      record("c", "morning", "2026-05-19T07:00:00Z", { goal: "目標B" }),
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

    // 「夜」フィルタへ
    await user.click(screen.getByRole("tab", { name: "夜" }));

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
});
