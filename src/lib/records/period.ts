// 「今日」「今週」「今月」の判定を Asia/Tokyo 基準で行うためのヘルパー。
// JST は UTC+9 固定 (DST なし) なので 9 時間オフセットで計算する。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type BoundsUtc = {
  /** ISO 文字列 (UTC)、範囲の開始 (inclusive) */
  start: string;
  /** ISO 文字列 (UTC)、範囲の終了 (exclusive) */
  end: string;
};

/** 与えられた瞬間が属する JST の暦日 (年・月・日) を返す。 */
function jstParts(now: Date): { y: number; m: number; d: number; weekday: number } {
  const jstMs = now.getTime() + JST_OFFSET_MS;
  const jst = new Date(jstMs);
  return {
    y: jst.getUTCFullYear(),
    m: jst.getUTCMonth(), // 0-indexed
    d: jst.getUTCDate(),
    weekday: jst.getUTCDay(), // 0=日, 1=月, ... 6=土
  };
}

/** JST の (y, m, d) 00:00 が表す UTC の瞬間を返す。 */
function jstMidnightToUtc(y: number, m: number, d: number): Date {
  // UTC ミリ秒から JST_OFFSET_MS を引いた値が JST midnight に相当する。
  // ただし Date.UTC(y, m, d) は UTC の 00:00 を表すので、それから 9h 引く。
  const utcMs = Date.UTC(y, m, d) - JST_OFFSET_MS;
  return new Date(utcMs);
}

export function getJstDayBoundsUtc(now: Date = new Date()): BoundsUtc {
  const { y, m, d } = jstParts(now);
  const start = jstMidnightToUtc(y, m, d);
  const end = jstMidnightToUtc(y, m, d + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getJstWeekBoundsUtc(now: Date = new Date()): BoundsUtc {
  const { y, m, d, weekday } = jstParts(now);
  // 月曜始まり: weekday=1 のとき diff=0、=0 (日) のとき diff=-6
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const start = jstMidnightToUtc(y, m, d + diffToMonday);
  const end = jstMidnightToUtc(y, m, d + diffToMonday + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getJstMonthBoundsUtc(now: Date = new Date()): BoundsUtc {
  const { y, m } = jstParts(now);
  const start = jstMidnightToUtc(y, m, 1);
  const end = jstMidnightToUtc(y, m + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
