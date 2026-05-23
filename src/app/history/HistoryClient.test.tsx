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
  targetDate: string | null = null,
): RecordRow {
  return {
    id,
    type,
    answers,
    checks: {},
    target_date: targetDate,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const DEFAULT_PROPS = {
  year: 2026,
  todayDate: "2026-05-21",
  todayYear: 2026,
};

describe("HistoryClient", () => {
  beforeEach(() => {
    deleteRecord.mockReset();
    refresh.mockReset();
  });

  it("renders a back-to-home link", () => {
    render(<HistoryClient records={[]} {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /ホームへ戻る/ });
    expect(link).toHaveAttribute("href", "/");
  });

  it("shows an empty state when there are no records", () => {
    render(<HistoryClient records={[]} {...DEFAULT_PROPS} />);
    expect(screen.getByText(/まだ記録がありません/)).toBeInTheDocument();
  });

  it("件数バッジ付きフィルタチップが種別ごとに件数を出す", () => {
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T03:00:00Z"),
      record("b", "morning", "2026-05-19T03:00:00Z"),
      record("c", "night", "2026-05-20T13:00:00Z"),
    ];
    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    expect(screen.getByRole("button", { name: /すべて 3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /朝 2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /夜 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /週目標 0/ })).toBeInTheDocument();
  });

  it("List ビューに切り替えると日付グループで表示される", async () => {
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T03:00:00Z", { goal: "目標A" }),
      record("b", "night", "2026-05-20T11:00:00Z", { done: "夜A" }),
      record("c", "morning", "2026-05-19T05:00:00Z", { goal: "目標B" }),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole("button", { name: /📜 リスト/ }));

    const sections = screen.getAllByRole("region", { name: /2026年5月/ });
    expect(sections).toHaveLength(2);
    expect(within(sections[0]).getAllByRole("article")).toHaveLength(2);
    expect(within(sections[1]).getAllByRole("article")).toHaveLength(1);
  });

  it("List ビュー: target_date が created_at と異なる場合はセクション見出しも target_date 基準", async () => {
    // PR #31 統合: 夜 22:00 JST に翌日 morning を書いた場合
    // grouping は target_date=2026-05-21、見出しも 2026-05-21 と一致する
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record(
        "next-day-morning",
        "morning",
        "2026-05-20T13:00:00Z", // created_at JST 5/20 22:00
        { goal: "明日の目標" },
        "2026-05-21", // target_date は翌日
      ),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: /📜 リスト/ }));

    expect(
      screen.getByRole("region", { name: /2026年5月21日/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /2026年5月20日/ }),
    ).not.toBeInTheDocument();
  });

  it("List ビューでフィルタを変えると表示が絞られる", async () => {
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T08:00:00Z", { goal: "目標A" }),
      record("b", "night", "2026-05-20T22:00:00Z", { done: "夜A" }),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole("button", { name: /📜 リスト/ }));

    expect(screen.getAllByRole("article")).toHaveLength(2);

    const nightButton = screen.getByRole("button", { name: /夜 1/ });
    expect(nightButton).toHaveAttribute("aria-pressed", "false");
    await user.click(nightButton);
    expect(nightButton).toHaveAttribute("aria-pressed", "true");

    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("Calendar ビューで日付クリックすると右ペインに記録が出る", async () => {
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T03:00:00Z", { goal: "目標A" }),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    // 5/20 を選ぶ
    await user.click(screen.getByRole("gridcell", { name: /20日/ }));

    const region = screen.getByRole("region", { name: /選択日の記録/ });
    expect(within(region).getByRole("article")).toBeInTheDocument();
  });

  it("年切替 chip は前年/翌年へのリンク", () => {
    render(<HistoryClient records={[]} {...DEFAULT_PROPS} />);

    expect(screen.getByRole("link", { name: /‹ 2025/ })).toHaveAttribute(
      "href",
      "/history?year=2025",
    );
    expect(screen.getByRole("link", { name: /2027 ›/ })).toHaveAttribute(
      "href",
      "/history?year=2027",
    );
  });

  it("過去年表示時は年の足跡見出しに表示年が反映される", () => {
    render(
      <HistoryClient records={[]} year={2024} todayDate="2026-05-21" todayYear={2026} />,
    );
    expect(screen.getByText(/2024年の足跡/)).toBeInTheDocument();
  });

  it("年間ヒートマップが描画される (role=img + aria-label)", () => {
    render(<HistoryClient records={[]} {...DEFAULT_PROPS} />);
    expect(
      screen.getByRole("img", { name: /2026年の記録ヒートマップ/ }),
    ).toBeInTheDocument();
  });

  it("記録カードに編集リンクが /flows/<type>?edit=<id> として張られる", async () => {
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("abc", "morning", "2026-05-20T03:00:00Z"),
    ];
    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    // List ビューに切り替えて編集リンクを検出
    await user.click(screen.getByRole("button", { name: /📜 リスト/ }));

    const link = screen.getByRole("link", { name: "編集する" });
    expect(link).toHaveAttribute("href", "/flows/morning?edit=abc");
  });

  it("削除ボタンは confirm 承認後に deleteRecord を呼ぶ", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteRecord.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("abc", "morning", "2026-05-20T03:00:00Z"),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: /📜 リスト/ }));
    await user.click(screen.getByRole("button", { name: "この記録を削除" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteRecord).toHaveBeenCalledWith("abc");
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  it("Calendar ビュー: フィルタで除外された日と本当に空の日でメッセージを区別する", async () => {
    // Copilot review PR #33 指摘: 「この日の記録はまだありません」が
    // フィルタ除外時にも出るのは誤解を招くので文言を分ける
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T03:00:00Z"), // 5/20 に morning 1 件
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    // 5/20 を選択 (デフォルトは今日 = 5/21 なので明示的にクリック)
    await user.click(screen.getByRole("gridcell", { name: /20日/ }));

    // フィルタ「夜」に絞り込み → 5/20 は morning だけなので除外される
    await user.click(screen.getByRole("button", { name: /夜 0/ }));

    expect(
      screen.getByText(/この種別の記録はこの日にはありません/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("この日の記録はまだありません"),
    ).not.toBeInTheDocument();
  });

  it("Calendar ビュー: そもそも記録が無い日は「まだありません」を出す", async () => {
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T03:00:00Z"), // 5/20 のみ
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    // 記録が無い 5/15 を選択
    await user.click(screen.getByRole("gridcell", { name: /^15日/ }));

    expect(
      screen.getByText("この日の記録はまだありません"),
    ).toBeInTheDocument();
  });

  it("カレンダーの aria-label は同日複数 record の実件数を読み上げる", () => {
    // Copilot review PR #33 指摘: types.size でなく実際の件数を使う
    const records: RecordRow[] = [
      record("a", "morning", "2026-05-20T03:00:00Z"),
      record("b", "morning", "2026-05-20T04:00:00Z"), // 同日 同 type 2 件目
      record("c", "night", "2026-05-20T13:00:00Z"),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    const cell = screen.getByRole("gridcell", { name: /20日/ });
    expect(cell.getAttribute("aria-label")).toContain("3件の記録");
  });

  it("削除失敗時は内部メッセージではなく汎用メッセージを表示する", async () => {
    // Copilot review PR #33 指摘: Supabase の SQL/RLS 詳細を UI に出さない
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    deleteRecord.mockResolvedValue({ ok: false, error: "permission denied for table records" });
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("abc", "morning", "2026-05-20T03:00:00Z"),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: /📜 リスト/ }));
    await user.click(screen.getByRole("button", { name: "この記録を削除" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/しばらくしてから再度お試しください/);
    expect(alert).not.toHaveTextContent(/permission denied/);
    confirmSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("confirm キャンセル時は deleteRecord を呼ばない", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    const records: RecordRow[] = [
      record("abc", "morning", "2026-05-20T03:00:00Z"),
    ];

    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: /📜 リスト/ }));
    await user.click(screen.getByRole("button", { name: "この記録を削除" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("Calendar: 矢印キーで日付セル間を移動できる (a11y キーボードナビ)", async () => {
    // Team review PR #33 P0: WAI-ARIA grid pattern の矢印キー操作の回帰防止
    const user = userEvent.setup();
    // EmptyState 回避のため最低 1 件用意
    const records = [record("a", "morning", "2026-05-20T03:00:00Z")];
    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    // 初期フォーカス対象 (= 今日 5/21) にタブで到達
    const todayCell = screen.getByRole("gridcell", { name: /21日/ });
    todayCell.focus();
    expect(todayCell).toHaveFocus();

    // ArrowRight → 5/22 (金)
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("gridcell", { name: /22日/ })).toHaveFocus();

    // ArrowDown → +7 日 = 5/29
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("gridcell", { name: /29日/ })).toHaveFocus();

    // ArrowUp → -7 日 = 5/22
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("gridcell", { name: /22日/ })).toHaveFocus();

    // ArrowLeft → 5/21
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("gridcell", { name: /21日/ })).toHaveFocus();
  });

  it("Calendar: roving tabindex で初期フォーカス対象は 1 つだけ", () => {
    // 当月の日付セルのうち tabIndex=0 は選択中の 1 つだけ
    const records = [record("a", "morning", "2026-05-20T03:00:00Z")];
    render(<HistoryClient records={records} {...DEFAULT_PROPS} />);

    const cells = screen.getAllByRole("gridcell");
    const focusable = cells.filter((c) => c.getAttribute("tabindex") === "0");
    expect(focusable).toHaveLength(1);
    // デフォルトでは今日 (5/21) が focusable
    expect(focusable[0].getAttribute("aria-label")).toMatch(/21日.*今日/);
  });
});
