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

/** ISO 文字列または Date を JST の YYYY-MM-DD 日付キーに変換する。
 *  History (heatmap / calendar dots / aggregates) と Group/Streak で共通利用。 */
export function toJstDateKey(input: string | Date): string {
  return dateKeyFormatter.format(input instanceof Date ? input : new Date(input));
}

/** record の「いつのための記録か」を JST 日付文字列で返す。
 *  target_date があれば優先、なければ created_at の JST 日付 (PR #31 で追加)。
 *  PR #31 マージ後に @/lib/records/targetDate の同名関数に寄せる予定。 */
export function resolveRecordDate(record: {
  target_date: string | null;
  created_at: string;
}): string {
  return record.target_date ?? toJstDateKey(record.created_at);
}

export function groupRecordsByDate(records: RecordRow[]): DateGroup[] {
  const map = new Map<string, RecordRow[]>();
  for (const r of records) {
    // target_date があれば「いつのための記録か」を優先、
    // なければ created_at の JST 日付 (旧データ互換)。
    const key = resolveRecordDate(r);
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

const monthFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
});

/** "2026年5月" のように年月を返す。 */
export function formatJstMonth(input: string | Date): string {
  return monthFormatter.format(
    input instanceof Date ? input : new Date(input),
  );
}

const shortDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  month: "numeric",
  day: "numeric",
});

/** "5/21" のように月/日を返す。 */
export function formatJstShortDate(input: string | Date): string {
  return shortDateFormatter.format(
    input instanceof Date ? input : new Date(input),
  );
}

const dateWithWeekdayFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

/** "2026年5月21日(木)" のように曜日付きフルデートを返す。formatDate と同じだが
 *  別名で意図を明示できる。 */
export function formatJstDateWithWeekday(input: string | Date): string {
  return dateWithWeekdayFormatter.format(
    input instanceof Date ? input : new Date(input),
  );
}

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** "07:30" のように時刻のみを返す (日付重複を避けたいときに使う)。 */
export function formatJstTime(input: string | Date): string {
  return timeFormatter.format(
    input instanceof Date ? input : new Date(input),
  );
}
