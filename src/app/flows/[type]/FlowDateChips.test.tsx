import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowDateChips } from "./FlowDateChips";

const may21noon = new Date("2026-05-21T03:00:00Z"); // JST 12:00 (木)

describe("FlowDateChips", () => {
  it("morning フローでは「今日 / 明日 / 明明日」のチップを 3 つ出す", () => {
    render(
      <FlowDateChips type="morning" value="2026-05-21" onChange={() => {}} now={may21noon} />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(/今日/);
    expect(radios[1]).toHaveAccessibleName(/明日/);
    expect(radios[2]).toHaveAccessibleName(/明明日/);
  });

  it("night フローでは「今日 / 昨日 / 一昨日」のチップを 3 つ出す", () => {
    render(
      <FlowDateChips type="night" value="2026-05-21" onChange={() => {}} now={may21noon} />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAccessibleName(/今日/);
    expect(radios[1]).toHaveAccessibleName(/昨日/);
    expect(radios[2]).toHaveAccessibleName(/一昨日/);
  });

  it("選択中のチップは checked になる", () => {
    render(
      <FlowDateChips type="morning" value="2026-05-22" onChange={() => {}} now={may21noon} />,
    );
    const [today, tomorrow] = screen.getAllByRole("radio");
    expect(today).not.toBeChecked();
    expect(tomorrow).toBeChecked();
  });

  it("チップクリックで onChange が呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FlowDateChips type="morning" value="2026-05-21" onChange={onChange} now={may21noon} />,
    );
    const [, tomorrow] = screen.getAllByRole("radio");
    await user.click(tomorrow);
    expect(onChange).toHaveBeenCalledWith("2026-05-22");
  });

  it("weeklyGoal は target_date を月曜に正規化して onChange に渡す", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FlowDateChips type="weeklyGoal" value="2026-05-18" onChange={onChange} now={may21noon} />,
    );
    // [今週, 来週, 再来週] のうち index=1 が来週
    const [, nextWeek] = screen.getAllByRole("radio");
    await user.click(nextWeek);
    expect(onChange).toHaveBeenCalledWith("2026-05-25");
  });

  it("ネイティブ date input は方向と一致しない日付を弾く", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FlowDateChips type="morning" value="2026-05-21" onChange={onChange} now={may21noon} />,
    );
    const dateInput = screen.getByLabelText("日付を直接指定");
    // 過去日 → onChange に渡されない (isAllowedDirection で false)
    await user.clear(dateInput);
    await user.type(dateInput, "2026-05-20");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("見出しは future / past で言葉を変える", () => {
    const { rerender } = render(
      <FlowDateChips type="morning" value="2026-05-21" onChange={() => {}} now={may21noon} />,
    );
    expect(screen.getByText("いつの分を書きますか？")).toBeInTheDocument();

    rerender(
      <FlowDateChips type="night" value="2026-05-21" onChange={() => {}} now={may21noon} />,
    );
    expect(screen.getByText("いつの振り返りですか？")).toBeInTheDocument();
  });

  // Issue #46: readOnly mode
  it("readOnly のとき radio / date input は表示されず、選択中の日付ラベルが出る", () => {
    render(
      <FlowDateChips
        type="morning"
        value="2026-05-22"
        onChange={() => {}}
        now={may21noon}
        readOnly
      />,
    );
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByLabelText("日付を直接指定")).not.toBeInTheDocument();
    // 選択中の日付情報が文字で表示される
    expect(screen.getByText(/明日/)).toBeInTheDocument();
    // 編集できない旨の説明
    expect(
      screen.getByText(/編集中は日付を変えられません/),
    ).toBeInTheDocument();
  });

  it("readOnly でも onChange は呼ばれない", async () => {
    const onChange = vi.fn();
    render(
      <FlowDateChips
        type="morning"
        value="2026-05-22"
        onChange={onChange}
        now={may21noon}
        readOnly
      />,
    );
    // 何もクリック可能要素が無い (radio も input も無い)
    expect(onChange).not.toHaveBeenCalled();
  });
});
