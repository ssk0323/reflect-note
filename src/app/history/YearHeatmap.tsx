type Props = {
  /** 表示する年 (例: 2026) */
  year: number;
  /** 日付ごとの記録件数 (YYYY-MM-DD → count) */
  countsByDate: Map<string, number>;
};

const WEEKDAY_LABELS = ["月", "", "水", "", "金", "", ""];

/** 与えられた年の年間ヒートマップを描画する。
 *
 *  - 列 = 週 (左から右へ時間が進む)、行 = 曜日 (月〜日)
 *  - 月曜始まり。年の最初の週は前年から、最後の週は翌年に食い込むため
 *    grid 上では塗りつぶしのない cell として表示する。
 *  - 色は 0/1/2/3+ 件の 4 段階で塗り分け。 */
export function YearHeatmap({ year, countsByDate }: Props) {
  // 年の最初の月曜日 (1/1 の属する週の月曜)
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfWeek = jan1.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const firstMonday = new Date(jan1.getTime() + diffToMonday * 24 * 60 * 60 * 1000);

  // 12/31 が属する週の月曜まで grid を伸ばす。閏年で 1/1 が日曜のときは
  // 54 列必要になる (例: 2012, 2040) ため、年の終端から動的に計算する
  // (Codex review PR #33 で指摘あり)。
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const dec31Dow = dec31.getUTCDay();
  const diffDec31ToMonday = dec31Dow === 0 ? -6 : 1 - dec31Dow;
  const lastMonday = new Date(dec31.getTime() + diffDec31ToMonday * 24 * 60 * 60 * 1000);
  const totalWeeks =
    Math.round((lastMonday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const cells: { week: number; day: number; dateKey: string | null; count: number }[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(
        firstMonday.getTime() + (w * 7 + d) * 24 * 60 * 60 * 1000,
      );
      const cellYear = cellDate.getUTCFullYear();
      // 年外の cell は空欄
      if (cellYear !== year) {
        cells.push({ week: w, day: d, dateKey: null, count: 0 });
        continue;
      }
      const yyyy = String(cellYear);
      const mm = String(cellDate.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(cellDate.getUTCDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;
      cells.push({ week: w, day: d, dateKey: key, count: countsByDate.get(key) ?? 0 });
    }
  }

  // 月ラベル: 各月の 1 日が属する週の位置を取得
  const monthLabels: { week: number; label: string }[] = [];
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(Date.UTC(year, m, 1));
    const diff = Math.floor(
      (firstOfMonth.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    if (diff >= 0 && diff < totalWeeks) {
      monthLabels.push({ week: diff, label: `${m + 1}月` });
    }
  }

  // SR 用にヒートマップの全体サマリを aria-label として要約する。
  // 個別 cell は <title> ベースでマウスホバーのみ参照可能なので、
  // 視覚的でない読者が「年全体の記録量」を把握できるよう数値を入れる。
  // (team review PR #33 で「Heatmap が SR で読めない」指摘あり)
  let totalRecords = 0;
  let activeDays = 0;
  for (const count of countsByDate.values()) {
    if (count > 0) {
      activeDays += 1;
      totalRecords += count;
    }
  }
  const ariaSummary = `${year}年の記録ヒートマップ。記録のある日 ${activeDays}日、合計 ${totalRecords}件`;

  return (
    <div role="img" aria-label={ariaSummary} className="overflow-x-auto">
      {/* Month labels above the grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `auto repeat(${totalWeeks}, 12px)`,
          gap: 3,
          marginBottom: 4,
        }}
      >
        <span />
        {Array.from({ length: totalWeeks }).map((_, w) => {
          const label = monthLabels.find((m) => m.week === w);
          return (
            <span
              key={w}
              className="sk-mono"
              style={{ fontSize: 9, textAlign: "left" }}
            >
              {label?.label ?? ""}
            </span>
          );
        })}
      </div>

      {/* Weekday labels + grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `auto repeat(${totalWeeks}, 12px)`,
          gap: 3,
        }}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={`wd-${i}`}
            className="sk-mono"
            style={{
              gridColumn: 1,
              gridRow: i + 1,
              fontSize: 9,
              alignSelf: "center",
              paddingRight: 4,
            }}
          >
            {label}
          </div>
        ))}
        {cells.map((c) => (
          <span
            key={`${c.week}-${c.day}`}
            title={c.dateKey ? `${c.dateKey}: ${c.count}件` : ""}
            style={{
              gridColumn: c.week + 2,
              gridRow: c.day + 1,
              aspectRatio: "1",
              borderRadius: 3,
              background: c.dateKey ? colorForCount(c.count) : "transparent",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function colorForCount(count: number): string {
  if (count === 0) return "var(--color-bg-3)";
  if (count === 1) return "var(--color-ink-4)";
  if (count === 2) return "var(--color-accent-soft)";
  return "var(--color-accent)";
}

export function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <LegendItem color="var(--color-bg-3)" label="なし" />
      <LegendItem color="var(--color-ink-4)" label="1件" />
      <LegendItem color="var(--color-accent-soft)" label="2件" />
      <LegendItem color="var(--color-accent)" label="3件+" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="sk-mono inline-flex items-center gap-1">
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          background: color,
          borderRadius: 2,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
