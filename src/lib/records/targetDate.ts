import type { FlowType } from "@/lib/flows";

/**
 * target_date 関連ロジック。
 *
 * - フローごとに「未来方向」(morning, weeklyGoal, monthlyGoal) と
 *   「過去方向」(night, weeklyReview, monthlyReview) を持つ。
 * - 週フローでは target_date は「その週の月曜日」を、月フローでは「その月の 1 日」を保存する。
 * - すべて JST (Asia/Tokyo) 基準で計算する。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "YYYY-MM-DD" 形式の JST 日付文字列バリデーション。 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(s: unknown): s is string {
  return typeof s === "string" && DATE_RE.test(s);
}

/** Date を JST の YYYY-MM-DD 形式に変換する。 */
export function toJstDateString(d: Date): string {
  const shifted = new Date(d.getTime() + JST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" の JST 日付を Date (JST 00:00 を表す UTC 瞬間) にパースする。 */
export function parseJstDateString(s: string): Date {
  if (!DATE_RE.test(s)) {
    throw new Error(`Invalid date string: ${s}`);
  }
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - JST_OFFSET_MS);
}

/** "YYYY-MM-DD" 同士の日数差 (a - b)。同日なら 0、a の方が後なら正。 */
export function diffDays(a: string, b: string): number {
  const aMs = parseJstDateString(a).getTime();
  const bMs = parseJstDateString(b).getTime();
  return Math.round((aMs - bMs) / (24 * 60 * 60 * 1000));
}

/** date に days を加算した JST 日付を返す。 */
export function addDays(dateStr: string, days: number): string {
  const t = parseJstDateString(dateStr).getTime() + days * 24 * 60 * 60 * 1000;
  return toJstDateString(new Date(t));
}

/** 指定 JST 日付が属する週の月曜日 (JST) を返す。月曜始まり。 */
export function startOfJstWeek(dateStr: string): string {
  const d = parseJstDateString(dateStr);
  const shifted = new Date(d.getTime() + JST_OFFSET_MS);
  const weekday = shifted.getUTCDay(); // 0=日, 1=月, ... 6=土
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateStr, diffToMonday);
}

/** 指定 JST 日付が属する月の 1 日 (JST) を返す。 */
export function startOfJstMonth(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

/** 月単位での加算 (正の n で未来、負の n で過去)。1日を保つ。 */
export function addMonths(dateStr: string, n: number): string {
  if (!DATE_RE.test(dateStr)) throw new Error(`Invalid date string: ${dateStr}`);
  const [y, m] = dateStr.split("-").map(Number);
  const totalMonths = (y - 1) * 12 + (m - 1) + n;
  const ny = Math.floor(totalMonths / 12) + 1;
  const nm = (totalMonths % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-01`;
}

/** フローの「正規化された target_date」を返す。週なら月曜、月なら 1 日に丸める。 */
export function normalizeTargetDate(type: FlowType, dateStr: string): string {
  if (type === "weeklyGoal" || type === "weeklyReview") {
    return startOfJstWeek(dateStr);
  }
  if (type === "monthlyGoal" || type === "monthlyReview") {
    return startOfJstMonth(dateStr);
  }
  return dateStr;
}

export type FlowDirection = "future" | "past";

/** フローの方向。Goal 系は未来、Review 系 + night は過去。 */
export function flowDirection(type: FlowType): FlowDirection {
  switch (type) {
    case "morning":
    case "weeklyGoal":
    case "monthlyGoal":
      return "future";
    case "night":
    case "weeklyReview":
    case "monthlyReview":
      return "past";
  }
}

export type DateOption = {
  value: string; // "YYYY-MM-DD" (週=月曜, 月=1日)
  label: string; // "今日" "明日" "今週" など短いチップ用ラベル
  detail: string; // "5/22(金)" "5/18〜5/24" "2026年5月" など補助テキスト
};

const ja = {
  day: (d: Date) => {
    const fmt = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    return fmt.format(d);
  },
  month: (d: Date) => {
    const fmt = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
    });
    return fmt.format(d);
  },
  shortDate: (d: Date) => {
    const fmt = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
    });
    return fmt.format(d);
  },
};

/**
 * 指定 now で、type の方向に沿った [今, +1, +2] (または [今, -1, -2]) の選択肢を返す。
 * 戻り値の先頭が「今 (デフォルト)」。
 */
export function defaultDateOptions(type: FlowType, now: Date = new Date()): DateOption[] {
  const today = toJstDateString(now);
  const direction = flowDirection(type);
  const sign = direction === "future" ? 1 : -1;

  if (type === "morning" || type === "night") {
    const offsets = [0, sign * 1, sign * 2];
    const dayLabels =
      direction === "future"
        ? ["今日", "明日", "明明日"]
        : ["今日", "昨日", "一昨日"];
    return offsets.map((off, idx) => {
      const dateStr = addDays(today, off);
      const d = parseJstDateString(dateStr);
      return {
        value: dateStr,
        label: dayLabels[idx],
        detail: ja.day(d),
      };
    });
  }

  if (type === "weeklyGoal" || type === "weeklyReview") {
    const thisWeek = startOfJstWeek(today);
    const offsets = [0, sign * 7, sign * 14];
    const labels =
      direction === "future"
        ? ["今週", "来週", "再来週"]
        : ["今週", "先週", "先々週"];
    return offsets.map((off, idx) => {
      const monday = addDays(thisWeek, off);
      const sunday = addDays(monday, 6);
      return {
        value: monday,
        label: labels[idx],
        detail: `${ja.shortDate(parseJstDateString(monday))}〜${ja.shortDate(parseJstDateString(sunday))}`,
      };
    });
  }

  // monthly
  const thisMonth = startOfJstMonth(today);
  const offsets = [0, sign * 1, sign * 2];
  const labels =
    direction === "future"
      ? ["今月", "来月", "再来月"]
      : ["今月", "先月", "先々月"];
  return offsets.map((off, idx) => {
    const monthStart = addMonths(thisMonth, off);
    return {
      value: monthStart,
      label: labels[idx],
      detail: ja.month(parseJstDateString(monthStart)),
    };
  });
}

/** 与えられた target_date が、type の方向制限に違反していないか検証。 */
export function isAllowedDirection(
  type: FlowType,
  targetDate: string,
  now: Date = new Date(),
): boolean {
  const todayKey = toJstDateString(now);
  const direction = flowDirection(type);
  const normalized = normalizeTargetDate(type, targetDate);
  const todayNormalized = normalizeTargetDate(type, todayKey);
  const diff = diffDays(normalized, todayNormalized);
  return direction === "future" ? diff >= 0 : diff <= 0;
}

/** カードや見出しに出す「いつの分」表記。 */
export function formatTargetLabel(type: FlowType, targetDate: string): string {
  const today = toJstDateString(new Date());
  if (type === "morning" || type === "night") {
    const offset = diffDays(targetDate, today);
    if (offset === 0) return "今日";
    if (offset === 1) return "明日";
    if (offset === -1) return "昨日";
    if (offset === 2) return "明明日";
    if (offset === -2) return "一昨日";
    return ja.day(parseJstDateString(targetDate));
  }
  if (type === "weeklyGoal" || type === "weeklyReview") {
    const thisWeek = startOfJstWeek(today);
    const offset = diffDays(targetDate, thisWeek);
    if (offset === 0) return "今週";
    if (offset === 7) return "来週";
    if (offset === -7) return "先週";
    if (offset === 14) return "再来週";
    if (offset === -14) return "先々週";
    const monday = parseJstDateString(targetDate);
    const sunday = parseJstDateString(addDays(targetDate, 6));
    return `${ja.shortDate(monday)}〜${ja.shortDate(sunday)}`;
  }
  // monthly
  const thisMonth = startOfJstMonth(today);
  const [ty, tm] = targetDate.split("-").map(Number);
  const [ny, nm] = thisMonth.split("-").map(Number);
  const offset = (ty - ny) * 12 + (tm - nm);
  if (offset === 0) return "今月";
  if (offset === 1) return "来月";
  if (offset === -1) return "先月";
  if (offset === 2) return "再来月";
  if (offset === -2) return "先々月";
  return ja.month(parseJstDateString(targetDate));
}

/** record.target_date があればそれを、なければ created_at の JST 日付を返す。 */
export function resolveRecordDate(record: {
  target_date: string | null;
  created_at: string;
}): string {
  return record.target_date ?? toJstDateString(new Date(record.created_at));
}
