-- records.checks[key] を atomic に反転する RPC。
-- read-modify-write の race condition (別タブ・連打) で他キーが
-- 消えるのを防ぐため、jsonb_set で 1 query 内で完結させる。
-- security invoker なので呼び出し元の権限 = RLS の update policy がそのまま効く。

create or replace function public.toggle_record_check(
  p_record_id uuid,
  p_key       text
)
returns boolean -- 反転後の値
language sql
security invoker
set search_path = pg_catalog, public
as $$
  update public.records
     set checks = jsonb_set(
                    coalesce(checks, '{}'::jsonb),
                    array[p_key],
                    to_jsonb(not coalesce((checks->>p_key)::boolean, false)),
                    true
                  )
   where id = p_record_id
   returning (checks->>p_key)::boolean;
$$;
