-- records.checks[key] を atomic に反転する RPC。
-- read-modify-write の race condition (別タブ・連打) で他キーが
-- 消えるのを防ぐため、jsonb_set で 1 query 内で完結させる。
-- security invoker なので呼び出し元の権限 = RLS の update policy がそのまま効く。
--
-- 前提:
--   * 0001_create_records_table.sql (records テーブル + RLS) 適用済み
--   * 0002_add_records_checks.sql (records.checks カラム) 適用済み
--   * 0003_harden_touch_updated_at.sql (search_path) 適用済み (推奨)
--
-- toggleCheck Server Action がこの RPC を呼ぶので、未適用だと本番で 500。

create or replace function public.toggle_record_check(
  p_record_id uuid,
  p_key       text
)
returns boolean -- 反転後の値。対象行が無い場合は NULL
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_new_value boolean;
begin
  -- p_key が NULL / 空文字だと jsonb_set の path 要素が NULL になり
  -- エラーになるので明示的に弾く。直接 RPC を叩かれても安全。
  if p_record_id is null or p_key is null or p_key = '' then
    return null;
  end if;

  update public.records
     set checks = jsonb_set(
                    coalesce(checks, '{}'::jsonb),
                    array[p_key],
                    to_jsonb(not coalesce((checks->>p_key)::boolean, false)),
                    true
                  )
   where id = p_record_id
  returning (checks->>p_key)::boolean into v_new_value;

  return v_new_value;
end;
$$;
