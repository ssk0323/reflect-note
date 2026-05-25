-- todos の position 整合性とパフォーマンスを補強する。
-- Team review P0/P1 で以下が指摘された:
--   1. reorderTodo の 2 段 UPDATE が非アトミックで position 重複が永続化し得る
--   2. createTodo の `select max + 1` が並列で同じ position を返す TOCTOU
--   3. acceptCarryProposal の position が target_date 全体 max ベースで bucket 整合性が崩れる
--   4. index `(user_id, target_date, position)` だと bucket スコープの max lookup で
--      seq scan に近い挙動になる
--
-- 対策:
--   A. UNIQUE (user_id, target_date, bucket, position) で物理的に重複を防ぐ
--   B. swap_todo_positions(id_a, id_b) RPC を 1 トランザクションで実行
--   C. 補助 index (user_id, target_date, bucket, position desc) で max lookup を O(1)
--
-- 既存の `(user_id, target_date, position)` index は fetchTodosForDate の主要クエリで
-- 使われているので残す。

-- A. UNIQUE 制約: 同じ user × 日 × bucket 内で position は一意
alter table public.todos
  add constraint todos_unique_position
  unique (user_id, target_date, bucket, position);

-- C. bucket スコープの max lookup 用 index
create index todos_user_target_bucket_position_desc_idx
  on public.todos (user_id, target_date, bucket, position desc);

-- B. position swap RPC
-- ・両 todo が同 user / 同 target_date / 同 bucket であることを保証
-- ・UNIQUE 制約を一時的に回避するため、片方を sentinel (-1) に退避 → swap → 戻す
-- ・security invoker + RLS により他人の todo は触れない
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
begin
  if id_a is null or id_b is null then
    raise exception 'id must not be null';
  end if;
  if id_a = id_b then
    raise exception 'cannot swap same row';
  end if;

  select position, target_date, bucket into pos_a, target_a, bucket_a
    from public.todos where id = id_a;
  if not found then
    raise exception 'todo not found: %', id_a using errcode = 'no_data_found';
  end if;

  select position, target_date, bucket into pos_b, target_b, bucket_b
    from public.todos where id = id_b;
  if not found then
    raise exception 'todo not found: %', id_b using errcode = 'no_data_found';
  end if;

  if target_a is distinct from target_b or bucket_a is distinct from bucket_b then
    raise exception 'todos must be in the same (target_date, bucket)';
  end if;

  -- sentinel 経由で swap (UNIQUE 制約を一時回避)。sentinel position は -1。
  -- 同 (user, target_date, bucket) に -1 が複数存在しないよう、ここでは
  -- id_a を sentinel に退避 → id_b に pos_a を入れる → id_a に pos_b を入れる順。
  update public.todos set position = -1 where id = id_a;
  update public.todos set position = pos_a where id = id_b;
  update public.todos set position = pos_b where id = id_a;
end;
$$;

-- 関数権限: authenticated ユーザーが呼び出せるように。
grant execute on function public.swap_todo_positions(uuid, uuid) to authenticated;
