import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { morningFlow } from "@/lib/flows/morning";
import { nightFlow } from "@/lib/flows/night";
import { toJstDateString } from "@/lib/records/targetDate";
import { FlowClient } from "./FlowClient";

// テスト実行時の「今日」(JST)。morningFlow は future 方向、nightFlow は past 方向
// のためどちらも today なら必ず通る。
const todayKey = toJstDateString(new Date());

const saveFlowRecord = vi.fn();
const findExistingRecord = vi.fn();

vi.mock("./actions", () => ({
  saveFlowRecord: (...args: unknown[]) => saveFlowRecord(...args),
  findExistingRecord: (...args: unknown[]) => findExistingRecord(...args),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("FlowClient (morning)", () => {
  beforeEach(() => {
    saveFlowRecord.mockReset();
    findExistingRecord.mockReset();
    // team review: 日付選択 step は常に経由する設計なので、各テストで
    // findExistingRecord を「既存なし」モックして「次へ」で step 0 に入る。
    findExistingRecord.mockResolvedValue({ ok: true, id: null });
    push.mockReset();
  });

  /** 日付選択 step を「次へ」で通過して step 0 に到達するためのヘルパー。
   *  team review P0: 全テストで日付選択 step を経由するようになったため。 */
  async function passDateStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "次へ" }));
  }

  it("shows the first question with progress 1/5", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);
    expect(
      await screen.findByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });

  it("advances to the next question on 次へ", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);

    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      screen.getByRole("heading", { name: morningFlow.questions[1].title }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("goes back to the previous question on 戻る", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "戻る" }));

    expect(
      screen.getByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
  });

  it("step 0 で戻るを押すと日付選択 step に戻る (常に有効)", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);
    // step 0 に居る
    expect(
      screen.getByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
    const back = screen.getByRole("button", { name: "戻る" });
    expect(back).not.toBeDisabled();
    await user.click(back);
    // 日付選択 step に戻る
    expect(
      screen.getByRole("heading", { name: "いつのぶんを書きますか？" }),
    ).toBeInTheDocument();
  });

  it("shows 一覧で確認する on the last question", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);

    for (let i = 0; i < morningFlow.questions.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }

    expect(
      screen.getByRole("button", { name: "一覧で確認する" }),
    ).toBeInTheDocument();
  });

  it("shows the confirmation screen with entered answers", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);

    // 1問目: goal (textarea) に入力
    await user.type(screen.getByRole("textbox"), "今日の目標テスト");
    // 全質問をスキップで進む
    for (let i = 0; i < morningFlow.questions.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }
    await user.click(screen.getByRole("button", { name: "一覧で確認する" }));

    // 確認画面: 入力した値が出る
    expect(screen.getByText("今日の目標テスト")).toBeInTheDocument();
    // 未入力は「未入力」と表示
    const ungivenItems = screen.getAllByText("未入力");
    expect(ungivenItems.length).toBe(morningFlow.questions.length - 1);
    expect(
      screen.getByRole("button", { name: "保存する" }),
    ).toBeInTheDocument();
  });

  it("calls saveFlowRecord with type + answers and redirects on save", async () => {
    saveFlowRecord.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);

    await user.type(screen.getByRole("textbox"), "目標");
    for (let i = 0; i < morningFlow.questions.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }
    await user.click(screen.getByRole("button", { name: "一覧で確認する" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(saveFlowRecord).toHaveBeenCalledWith(
      "morning",
      expect.objectContaining({ goal: "目標" }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows error message when saveFlowRecord fails", async () => {
    saveFlowRecord.mockResolvedValue({ ok: false, error: "boom" });
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);

    for (let i = 0; i < morningFlow.questions.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }
    await user.click(screen.getByRole("button", { name: "一覧で確認する" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("shows error message when saveFlowRecord throws", async () => {
    saveFlowRecord.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} initialDate={todayKey} />);
    await passDateStep(user);

    for (let i = 0; i < morningFlow.questions.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }
    await user.click(screen.getByRole("button", { name: "一覧で確認する" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
  });
});


describe("FlowClient date selection step (Issue #46)", () => {
  beforeEach(() => {
    saveFlowRecord.mockReset();
    findExistingRecord.mockReset();
    push.mockReset();
  });

  it("initialDate が無いときは「いつのぶんを書きますか？」を最初に出す", () => {
    render(<FlowClient flow={morningFlow} />);
    expect(
      screen.getByRole("heading", { name: "いつのぶんを書きますか？" }),
    ).toBeInTheDocument();
    // 質問はまだ表示されない
    expect(
      screen.queryByRole("heading", { name: morningFlow.questions[0].title }),
    ).not.toBeInTheDocument();
  });

  it("「次へ」で findExistingRecord が呼ばれ、既存無しなら質問 1 へ進む", async () => {
    findExistingRecord.mockResolvedValue({ ok: true, id: null });
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);
    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(findExistingRecord).toHaveBeenCalledWith(
      "morning",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    // 既存無しなので質問 1 が表示される
    expect(
      await screen.findByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
  });

  it("「次へ」で既存 record が見つかったら /flows/morning?edit=<id>&from=flow に router.push", async () => {
    findExistingRecord.mockResolvedValue({ ok: true, id: "rec-123" });
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);
    await user.click(screen.getByRole("button", { name: "次へ" }));
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/flows/morning?edit=rec-123&from=flow",
      ),
    );
  });

  it("findExistingRecord エラー時は alert を出す", async () => {
    findExistingRecord.mockResolvedValue({
      ok: false,
      error: "確認失敗",
    });
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);
    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("確認失敗");
  });

  it("質問 step では FlowDateChips の見出し「いつのぶんを書きますか？」は出ない", async () => {
    findExistingRecord.mockResolvedValue({ ok: true, id: null });
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);
    await user.click(screen.getByRole("button", { name: "次へ" }));
    // 日付選択画面の見出しが残らない (PR #47 review)
    expect(
      await screen.findByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "いつのぶんを書きますか？" }),
    ).not.toBeInTheDocument();
  });

  it("質問 step 0 で「戻る」を押すと日付選択画面に戻る (initialDate 無し時)", async () => {
    findExistingRecord.mockResolvedValue({ ok: true, id: null });
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);
    await user.click(screen.getByRole("button", { name: "次へ" }));
    // 質問 step に居る
    expect(
      await screen.findByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
    // 戻るボタンが押せる (disabled でない)
    const back = screen.getByRole("button", { name: "戻る" });
    expect(back).not.toBeDisabled();
    await user.click(back);
    // 日付選択画面に戻る
    expect(
      screen.getByRole("heading", { name: "いつのぶんを書きますか？" }),
    ).toBeInTheDocument();
  });
});

describe("FlowClient (night, group question)", () => {
  beforeEach(() => {
    saveFlowRecord.mockReset();
    findExistingRecord.mockReset();
    findExistingRecord.mockResolvedValue({ ok: true, id: null });
    push.mockReset();
  });

  it("renders the timeUsage group with 4 sub-fields", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={nightFlow} initialDate={todayKey} />);
    // 日付選択 step を経由
    await user.click(screen.getByRole("button", { name: "次へ" }));

    // timeUsage は 6 問目 (index 5)。5 回「次へ」で到達
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }

    expect(
      screen.getByRole("heading", { name: "時間の使い方を振り返る" }),
    ).toBeInTheDocument();
    expect(screen.getByText("朝")).toBeInTheDocument();
    expect(screen.getByText("午前")).toBeInTheDocument();
    expect(screen.getByText("午後")).toBeInTheDocument();
    expect(screen.getByText("夜")).toBeInTheDocument();
  });

  it("saves group-field answers under their own keys", async () => {
    saveFlowRecord.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<FlowClient flow={nightFlow} initialDate={todayKey} />);
    // 日付選択 step を経由
    await user.click(screen.getByRole("button", { name: "次へ" }));

    // timeUsage の画面まで進める
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }

    // ラベル経由で取得し、index 依存を避ける
    await user.type(screen.getByLabelText("朝"), "朝の話");
    await user.type(screen.getByLabelText("午前"), "午前の話");
    await user.type(screen.getByLabelText("午後"), "午後の話");
    await user.type(screen.getByLabelText("夜"), "夜の話");

    // 残り 1 問進めて確認画面へ
    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "一覧で確認する" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(saveFlowRecord).toHaveBeenCalledWith(
      "night",
      expect.objectContaining({
        timeMorning: "朝の話",
        timeForenoon: "午前の話",
        timeAfternoon: "午後の話",
        timeNight: "夜の話",
      }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });
});
