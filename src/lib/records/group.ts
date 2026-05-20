import type { RecordRow } from "./types";

export type DateGroup = {
  dateKey: string; // YYYY-MM-DD (UTC ベース)
  records: RecordRow[];
};

function toDateKey(isoDateTime: string): string {
  // 日付部分を YYYY-MM-DD で取り出す。タイムゾーンは UTC ベース
  // (records.created_at は ISO 文字列で保存されており UTC で正規化される想定)
  return isoDateTime.slice(0, 10);
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
  return Array.from(map.entries()).map(([dateKey, recordsInGroup]) => ({
    dateKey,
    records: recordsInGroup,
  }));
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export function formatDate(isoDateTime: string): string {
  return dateFormatter.format(new Date(isoDateTime));
}

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
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
