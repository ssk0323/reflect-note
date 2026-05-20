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
      expect.objectContaining({ goal: "new goal" }),
    );
    expect(push).toHaveBeenCalledWith("/history");
  });

  it("shows error message when updateFlowRecord fails", async () => {
    updateFlowRecord.mockResolvedValue({ ok: false, error: "boom" });
    const user = userEvent.setup();
    render(
      <EditClient flow={morningFlow} recordId="abc" initialAnswers={{}} />,
    );

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("renders group fields (timeUsage) as labeled inputs", () => {
    render(
      <EditClient flow={nightFlow} recordId="abc" initialAnswers={{}} />,
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
      <EditClient flow={morningFlow} recordId="abc" initialAnswers={{}} />,
    );
    const cancel = screen.getByRole("link", { name: "キャンセル" });
    expect(cancel).toHaveAttribute("href", "/history");
  });
});
