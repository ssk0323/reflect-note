-- touch_updated_at() の search_path を固定し、Supabase DB linter の
-- "Function Search Path Mutable" 警告を解消する。
-- 関数本体は変更せず create or replace で書き直す (trigger 再作成は不要)。

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
