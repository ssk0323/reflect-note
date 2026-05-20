import type { RecordRow } from "./types";

export type DateGroup = {
  dateKey: string; // YYYY-MM-DD (JST ベース)
  records: RecordRow[];
};

// グルーピングと表示のタイムゾーンを統一する。
// reflect-note は日本のユーザーが日本時間で記録するのが前提なので、
// SSR/CSR 環境に関わらず常に Asia/Tokyo を使う。
const TIME_ZONE = "Asia/Tokyo";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDateKey(isoDateTime: string): string {
  // en-CA locale は YYYY-MM-DD で返してくれるので、JST の日付文字列を取得できる
  return dateKeyFormatter.format(new Date(isoDateTime));
}

export function groupRecordsByDate(records: RecordRow[]): DateGroup[] {
  const map = new Map<string, RecordRow[]>();
  for (const r of records) {
    const key = toDateKey(r.created_at);
    const arr = map.get(key);
    if (arr) {
      arr.push(r);
    } else {
      map.set(key, [r]);
    }
  }
  // dateKey の降順で安定したグループ順を返す。
  // Map 挿入順に頼らないことで、呼び出し側の事前 sort 状態に依存しなくなる。
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dateKey, recordsInGroup]) => ({ dateKey, records: recordsInGroup }));
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export function formatDate(isoDateTime: string): string {
  return dateFormatter.format(new Date(isoDateTime));
}

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(isoDateTime: string): string {
  return dateTimeFormatter.format(new Date(isoDateTime));
}
