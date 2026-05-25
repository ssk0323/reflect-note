-- Issue #42: ToDo の並び替えを「タップで掴む → 行間スロットを挿入」モデル
-- (B-1a) に対応するため、任意位置 (bucket × position) への移動を atomic に
-- 実行する RPC を追加する。
--
-- 既存の `swap_todo_positions` は隣接 2 件の swap だけで、bucket 跨ぎや
-- 任意位置への挿入には対応していない。`updateTodo` の bucket 変更は末尾
-- 追加だけ。これら両方の用途を吸収できる単一 RPC として `move_todo` を導入。
--
-- 並び替えのアルゴリズム:
--   (a) Same bucket:
--       - src.position < new_position なら (src.pos, new_pos] を -1 シフト
--       - src.position > new_position なら [new_pos, src.pos) を +1 シフト
--       - 移動 todo を new_position に
--   (b) Different bucket:
--       - src bucket: position > src.pos を -1 シフト (ギャップを閉じる)
--       - tgt bucket: position >= new_pos を +1 シフト (ギャップを開ける)
--       - 移動 todo を (new_bucket, new_position) に
--
-- DEFERRABLE INITIALLY DEFERRED UNIQUE (migration 0010) により、関数内で
-- 一時的に同じ position が重複しても commit 時に解消されればよい。
-- security invoker + RLS で他人の todo を触れないことを担保。

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
    raise exception 'id required';
  end if;
  if caller is null then
    raise exception 'authentication required';
  end if;
  if new_position < 0 then
    raise exception 'position must be >= 0' using errcode = 'check_violation';
  end if;

  -- 移動元を取得 + 行ロック。RLS で他人の todo は SELECT できないので NULL になる。
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

  -- 移動先 bucket の現在件数を取得 (移動 todo 自身は除く)
  -- new_position は 0..tgt_count の範囲に clamp する。
  select count(*) into tgt_count
    from public.todos
    where user_id = caller
      and target_date = src_target_date
      and bucket = new_bucket
      and id <> todo_id;

  adjusted_position := least(new_position, tgt_count);

  -- 同じ場所への移動は no-op
  if src_bucket = new_bucket and src_position = adjusted_position then
    return;
  end if;

  if src_bucket = new_bucket then
    -- (a) Same bucket
    if src_position < adjusted_position then
      -- 下方向の移動: (src.pos, new_pos] を -1 シフト
      update public.todos
        set position = position - 1
        where user_id = caller
          and target_date = src_target_date
          and bucket = src_bucket
          and position > src_position
          and position <= adjusted_position;
    else
      -- 上方向の移動: [new_pos, src.pos) を +1 シフト
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
    -- (b) Different bucket: 移動元のギャップを閉じ、移動先のギャップを開ける
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

revoke execute on function public.move_todo(uuid, todo_bucket, integer) from public;
revoke execute on function public.move_todo(uuid, todo_bucket, integer) from anon;
grant execute on function public.move_todo(uuid, todo_bucket, integer) to authenticated;
