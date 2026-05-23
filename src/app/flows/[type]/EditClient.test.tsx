import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { morningFlow } from "@/lib/flows/morning";
import { nightFlow } from "@/lib/flows/night";
import { EditClient } from "./EditClient";

const updateFlowRecord = vi.fn();

vi.mock("./actions", () => ({
  updateFlowRecord: (...args: unknown[]) => updateFlowRecord(...args),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("EditClient", () => {
  beforeEach(() => {
    updateFlowRecord.mockReset();
    push.mockReset();
  });

  it("renders all question titles on the same screen", () => {
    render(
      <EditClient
        flow={morningFlow}
        recordId="abc"
        initialTargetDate={null}
        initialFallbackDate="2026-05-21"
        initialAnswers={{}}
      />,
    );

    // 5 質問のタイトルがすべて見える
    for (const q of morningFlow.questions) {
      expect(screen.getByText(q.title)).toBeInTheDocument();
    }
  });

  it("pre-fills inputs from initialAnswers", () => {
    render(
      <EditClient
        flow={morningFlow}
        recordId="abc"
        initialTargetDate={null}
        initialFallbackDate="2026-05-21"
        initialAnswers={{
          goal: "GOAL_VALUE",
          task1: "TASK1_VALUE",
        }}
      />,
    );

    // textarea と input がそれぞれ初期値で埋まっている
    expect(screen.getByDisplayValue("GOAL_VALUE")).toBeInTheDocument();
    expect(screen.getByDisplayValue("TASK1_VALUE")).toBeInTheDocument();
  });

  it("calls updateFlowRecord with the record id and current answers on save", async () => {
    updateFlowRecord.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <EditClient
        flow={morningFlow}
        recordId="abc"
        initialTargetDate={null}
        initialFallbackDate="2026-05-21"
        initialAnswers={{ goal: "old" }}
      />,
    );

    // goal を上書き
    const goalInput = screen.getByDisplayValue("old");
    await user.clear(goalInput);
    await user.type(goalInput, "new goal");

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(updateFlowRecord).toHaveBeenCalledWith(
      "abc",
      "morning",
      expect.objectContaining({ goal: "new goal" }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(push).toHaveBeenCalledWith("/history");
  });

  it("shows error message when updateFlowRecord fails", async () => {
    updateFlowRecord.mockResolvedValue({ ok: false, error: "boom" });
    const user = userEvent.setup();
    render(
      <EditClient flow={morningFlow} recordId="abc" initialAnswers={{}} initialTargetDate={null} initialFallbackDate="2026-05-21" />,
    );

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("renders group fields (timeUsage) as labeled inputs", () => {
    render(
      <EditClient flow={nightFlow} recordId="abc" initialAnswers={{}} initialTargetDate={null} initialFallbackDate="2026-05-21" />,
    );

    // group の 4 つの label が並んで見える
    expect(screen.getByText("時間の使い方を振り返る")).toBeInTheDocument();
    expect(screen.getByLabelText("朝")).toBeInTheDocument();
    expect(screen.getByLabelText("午前")).toBeInTheDocument();
    expect(screen.getByLabelText("午後")).toBeInTheDocument();
    expect(screen.getByLabelText("夜")).toBeInTheDocument();
  });

  it("renders a cancel link to /history", () => {
    render(
      <EditClient flow={morningFlow} recordId="abc" initialAnswers={{}} initialTargetDate={null} initialFallbackDate="2026-05-21" />,
    );
    const cancel = screen.getByRole("link", { name: "キャンセル" });
    expect(cancel).toHaveAttribute("href", "/history");
  });

  it("旧データ (target_date NULL) の編集では initialFallbackDate を保存時に渡す", async () => {
    // Codex/Copilot P1 指摘: NULL の旧レコードを保存しただけで today に書き換わる回帰を防ぐ
    updateFlowRecord.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <EditClient
        flow={morningFlow}
        recordId="legacy-1"
        initialTargetDate={null}
        initialFallbackDate="2026-04-10"
        initialAnswers={{ goal: "古い目標" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(updateFlowRecord).toHaveBeenCalledWith(
      "legacy-1",
      "morning",
      expect.objectContaining({ goal: "古い目標" }),
      "2026-04-10",
    );
  });

  it("週フローでは initialFallbackDate をその週の月曜日に丸めて使う", async () => {
    updateFlowRecord.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    // 2026-05-21 (木) は 2026-05-18 (月) を含む週
    const { weeklyGoalFlow } = await import("@/lib/flows/weeklyGoal");
    render(
      <EditClient
        flow={weeklyGoalFlow}
        recordId="legacy-week"
        initialTargetDate={null}
        initialFallbackDate="2026-05-21"
        initialAnswers={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(updateFlowRecord).toHaveBeenCalledWith(
      "legacy-week",
      "weeklyGoal",
      expect.anything(),
      "2026-05-18",
    );
  });
});
