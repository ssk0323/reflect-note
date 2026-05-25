-- PR #45 Copilot review: move_todo RPC (migration 0014) で
-- new_position / new_bucket が NULL の場合の明示的エラーが無く、
-- `new_position < 0` の比較が NULL で通過 → `least(NULL, n)` で adjusted_position
-- が NULL → 以降の比較 / UPDATE で position=NULL or bucket=NULL を試みて
-- 想定外の挙動になる経路があった。
--
-- 解決策: 冒頭で NULL チェックを追加し、明示的に例外を投げる。
-- migration 0014 は既に remote に適用済みなので、本 migration で
-- create or replace function により関数本体を更新する (関数シグネチャは同じ)。

create or replace function public.move_todo(
  todo_id uuid,
  new_bucket todo_bucket,
  new_position integer
) returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  src_user_id uuid;
  src_target_date date;
  src_bucket todo_bucket;
  src_position integer;
  caller uuid := auth.uid();
  tgt_count integer;
  adjusted_position integer;
begin
  if todo_id is null then
    raise exception 'todo_id required';
  end if;
  -- PR #45 review: NULL ガード追加
  if new_bucket is null then
    raise exception 'new_bucket required';
  end if;
  if new_position is null then
    raise exception 'new_position required';
  end if;
  if caller is null then
    raise exception 'authentication required';
  end if;
  if new_position < 0 then
    raise exception 'position must be >= 0' using errcode = 'check_violation';
  end if;

  select user_id, target_date, bucket, position
    into src_user_id, src_target_date, src_bucket, src_position
    from public.todos
    where id = todo_id
    for update;

  if src_user_id is null then
    raise exception 'todo not found: %', todo_id using errcode = 'no_data_found';
  end if;
  if src_user_id <> caller then
    raise exception 'permission denied' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into tgt_count
    from public.todos
    where user_id = caller
      and target_date = src_target_date
      and bucket = new_bucket
      and id <> todo_id;

  adjusted_position := least(new_position, tgt_count);

  if src_bucket = new_bucket and src_position = adjusted_position then
    return;
  end if;

  if src_bucket = new_bucket then
    if src_position < adjusted_position then
      update public.todos
        set position = position - 1
        where user_id = caller
          and target_date = src_target_date
          and bucket = src_bucket
          and position > src_position
          and position <= adjusted_position;
    else
      update public.todos
        set position = position + 1
        where user_id = caller
          and target_date = src_target_date
          and bucket = src_bucket
          and position >= adjusted_position
          and position < src_position;
    end if;
    update public.todos
      set position = adjusted_position
      where id = todo_id;
  else
    update public.todos
      set position = position - 1
      where user_id = caller
        and target_date = src_target_date
        and bucket = src_bucket
        and position > src_position;

    update public.todos
      set position = position + 1
      where user_id = caller
        and target_date = src_target_date
        and bucket = new_bucket
        and position >= adjusted_position;

    update public.todos
      set bucket = new_bucket, position = adjusted_position
      where id = todo_id;
  end if;
end;
$$;
