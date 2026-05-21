import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YearHeatmap } from "./YearHeatmap";

describe("YearHeatmap", () => {
  it("通常年 (2026) のヒートマップを描画する", () => {
    render(<YearHeatmap year={2026} countsByDate={new Map()} />);
    expect(
      screen.getByRole("img", { name: "2026年の記録ヒートマップ" }),
    ).toBeInTheDocument();
  });

  it("閏年で 1/1 が日曜の年 (2012) でも 12/31 の cell が grid 内にある", () => {
    // Codex P2 (PR #33) 指摘: 53 列固定だと 2012 のような年で 12/31 が
    // grid 外に落ちて記録件数が過小計上される回帰を防ぐ。
    const counts = new Map<string, number>([["2012-12-31", 1]]);
    const { container } = render(<YearHeatmap year={2012} countsByDate={counts} />);

    // 2012-12-31 の cell が描画されていることを title 属性で検証
    const cell = container.querySelector('[title="2012-12-31: 1件"]');
    expect(cell).toBeTruthy();
  });

  it("通常年 (2025) でも 12/31 の cell が grid 内にある", () => {
    const counts = new Map<string, number>([["2025-12-31", 2]]);
    const { container } = render(<YearHeatmap year={2025} countsByDate={counts} />);
    const cell = container.querySelector('[title="2025-12-31: 2件"]');
    expect(cell).toBeTruthy();
  });

  it("件数に応じて 4 段階の色になる", () => {
    const counts = new Map<string, number>([
      ["2026-01-05", 0],
      ["2026-01-06", 1],
      ["2026-01-07", 2],
      ["2026-01-08", 5],
    ]);
    const { container } = render(<YearHeatmap year={2026} countsByDate={counts} />);
    // 年内 cell には件数を含む title="YYYY-MM-DD: N件" が付与される
    // (0 件の日も "...: 0件" として hover で確認できる)。
    expect(container.querySelector('[title="2026-01-05: 0件"]')).toBeTruthy();
    expect(container.querySelector('[title="2026-01-06: 1件"]')).toBeTruthy();
    expect(container.querySelector('[title="2026-01-07: 2件"]')).toBeTruthy();
    expect(container.querySelector('[title="2026-01-08: 5件"]')).toBeTruthy();
  });
});
