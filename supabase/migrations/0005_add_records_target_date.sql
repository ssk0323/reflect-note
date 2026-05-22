-- records.target_date: 「いつのための記録か」を保存する nullable な日付。
-- 例: 夜 22時に明日の morning を書きたいとき、target_date = 明日の日付 を保存する。
-- NULL のときは created_at の JST 日付を fallback として扱う (既存レコードと後方互換)。

alter table public.records
  add column target_date date null;

-- 「ある type の target_date 最新を引く」が Home/History の主要クエリ。
-- (user_id, type, target_date desc nulls last) で nulls last 指定し、
-- target_date 付きを優先しつつ NULL のも拾えるようにする。
create index records_user_type_target_date_idx
  on public.records (user_id, type, target_date desc nulls last);
