import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { morningFlow } from "@/lib/flows/morning";
import { nightFlow } from "@/lib/flows/night";
import { FlowClient } from "./FlowClient";

const saveFlowRecord = vi.fn();

vi.mock("./actions", () => ({
  saveFlowRecord: (...args: unknown[]) => saveFlowRecord(...args),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("FlowClient (morning)", () => {
  beforeEach(() => {
    saveFlowRecord.mockReset();
    push.mockReset();
  });

  it("shows the first question with progress 1/5", () => {
    render(<FlowClient flow={morningFlow} />);
    expect(
      screen.getByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });

  it("advances to the next question on 次へ", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      screen.getByRole("heading", { name: morningFlow.questions[1].title }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("goes back to the previous question on 戻る", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "戻る" }));

    expect(
      screen.getByRole("heading", { name: morningFlow.questions[0].title }),
    ).toBeInTheDocument();
  });

  it("disables 戻る on the first question", () => {
    render(<FlowClient flow={morningFlow} />);
    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
  });

  it("shows 一覧で確認する on the last question", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);

    for (let i = 0; i < morningFlow.questions.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }

    expect(
      screen.getByRole("button", { name: "一覧で確認する" }),
    ).toBeInTheDocument();
  });

  it("shows the confirmation screen with entered answers", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={morningFlow} />);

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
    render(<FlowClient flow={morningFlow} />);

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
    render(<FlowClient flow={morningFlow} />);

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
    render(<FlowClient flow={morningFlow} />);

    for (let i = 0; i < morningFlow.questions.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
    }
    await user.click(screen.getByRole("button", { name: "一覧で確認する" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
  });
});


describe("FlowClient (night, group question)", () => {
  beforeEach(() => {
    saveFlowRecord.mockReset();
    push.mockReset();
  });

  it("renders the timeUsage group with 4 sub-fields", async () => {
    const user = userEvent.setup();
    render(<FlowClient flow={nightFlow} />);

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
    render(<FlowClient flow={nightFlow} />);

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
