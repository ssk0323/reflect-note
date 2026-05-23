-- PR #39 Copilot review round 3 で指摘された P0/P1 の解消:
--
-- 1. sentinel=-1 (旧 0008) や sentinel=-1000000-pos (0009) はいずれも
--    `position` カラムに任意の値が入れられる前提。ユーザーが Supabase SDK で
--    直接 `update todos set position = -1` を実行できるため、ある bucket 内に
--    予約 sentinel と衝突する行が永続化すると swap_todo_positions が
--    UNIQUE 違反で永続的に失敗する self-DoS が成立する。
--
-- 2. 解決策: position に CHECK (>= 0) を入れて負値を物理ブロックし、
--    UNIQUE 制約を DEFERRABLE INITIALLY DEFERRED にして transaction 内で
--    一時的な重複を許容する。swap は sentinel 不要の 2 UPDATE で完結。
--
-- 3. 既存環境で position に重複がある可能性を defensive に潰す repair step も
--    入れておく (PR #39 review #4 への対応: 0008 適用前に重複があった環境への
--    後追い fix-up)。

-- 1) repair: もし重複 position が残っていたら、(user_id, target_date, bucket) 内で
--    created_at, id の順に 0 から振り直す
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, target_date, bucket
      order by position, created_at, id
    ) - 1 as new_position
  from public.todos
)
update public.todos t
set position = ranked.new_position
from ranked
where t.id = ranked.id
  and t.position is distinct from ranked.new_position;

-- 2) position >= 0 の CHECK 制約 (sentinel との衝突を物理ブロック)
alter table public.todos
  add constraint todos_position_nonneg_check check (position >= 0);

-- 3) UNIQUE 制約を DEFERRABLE INITIALLY DEFERRED に張り直す
--    (transaction 内で一時的に同じ position が複数存在することを許容)
alter table public.todos
  drop constraint todos_unique_position;

alter table public.todos
  add constraint todos_unique_position
  unique (user_id, target_date, bucket, position)
  deferrable initially deferred;

-- 4) swap_todo_positions を sentinel 不要の 2 UPDATE に簡素化
--    DEFERRABLE UNIQUE があれば、関数内 (= 単一 transaction) で
--    一時的に position が重複しても commit 時にチェックされる。
create or replace function public.swap_todo_positions(
  id_a uuid,
  id_b uuid
) returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  pos_a integer;
  pos_b integer;
  target_a date;
  target_b date;
  bucket_a todo_bucket;
  bucket_b todo_bucket;
  user_a uuid;
  user_b uuid;
  caller uuid := auth.uid();
begin
  if id_a is null or id_b is null then
    raise exception 'id must not be null';
  end if;
  if id_a = id_b then
    raise exception 'cannot swap same row';
  end if;
  if caller is null then
    raise exception 'authentication required';
  end if;

  -- 行ロックは id 辞書順で取得し A↔B / B↔A 同時実行時のデッドロックを防ぐ。
  if id_a < id_b then
    select position, target_date, bucket, user_id
      into pos_a, target_a, bucket_a, user_a
      from public.todos where id = id_a for update;
    select position, target_date, bucket, user_id
      into pos_b, target_b, bucket_b, user_b
      from public.todos where id = id_b for update;
  else
    select position, target_date, bucket, user_id
      into pos_b, target_b, bucket_b, user_b
      from public.todos where id = id_b for update;
    select position, target_date, bucket, user_id
      into pos_a, target_a, bucket_a, user_a
      from public.todos where id = id_a for update;
  end if;

  if user_a is null then
    raise exception 'todo not found: %', id_a using errcode = 'no_data_found';
  end if;
  if user_b is null then
    raise exception 'todo not found: %', id_b using errcode = 'no_data_found';
  end if;
  if user_a <> caller or user_b <> caller then
    raise exception 'permission denied' using errcode = 'insufficient_privilege';
  end if;
  if target_a is distinct from target_b or bucket_a is distinct from bucket_b then
    raise exception 'todos must be in the same (target_date, bucket)';
  end if;

  -- DEFERRABLE UNIQUE により、この 2 文の間で一時的に同じ position が
  -- 同 (user, target_date, bucket) 内に存在しても commit までは OK。
  update public.todos set position = pos_b where id = id_a;
  update public.todos set position = pos_a where id = id_b;
end;
$$;

revoke execute on function public.swap_todo_positions(uuid, uuid) from public;
revoke execute on function public.swap_todo_positions(uuid, uuid) from anon;
grant execute on function public.swap_todo_positions(uuid, uuid) to authenticated;
