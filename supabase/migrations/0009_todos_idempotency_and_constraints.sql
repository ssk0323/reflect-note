-- PR #39 team review (2 周目) で指摘された P0/P1 を解消する補強。
--
-- 1. carry の冪等性: (user_id, target_date, carry_from_date) の部分 UNIQUE index で
--    2 タブ同時 accept による重複 INSERT を物理ブロック。
-- 2. position default 0 を削除: アプリは常に明示指定するため、Studio / 別経路で
--    省略時に 0 が入って UNIQUE 違反を踏む経路を絶つ。
-- 3. CHECK 制約: text 長さ / target_date 範囲を DB 側でも強制し、アプリ層 sanitize の
--    バイパス経路 (Studio / psql 直叩き) を防ぐ。
-- 4. swap_todo_positions の改善: SELECT に FOR UPDATE を追加して並列 swap のレースを
--    シリアライズ。user_id 明示検証で防御深度を上げる。

-- 1) 部分 UNIQUE index: carry の冪等性
--    同じ「(today の target_date, 昨日の carry_from_date)」の組み合わせは 1 件のみ。
--    text を変えても重複扱いになるので、ユーザーが手動で text を編集してから再 accept
--    したケースでも重複しない (= 元 carry を編集していると見なす)。
create unique index todos_unique_carry_idem_idx
  on public.todos (user_id, target_date, carry_from_date)
  where carry_from_date is not null;

-- 2) position default 0 を削除
alter table public.todos
  alter column position drop default;

-- 3) CHECK 制約 (Studio / psql 直叩き対策)
alter table public.todos
  add constraint todos_text_length_check
    check (char_length(text) between 1 and 500);

alter table public.todos
  add constraint todos_target_date_range_check
    check (target_date between date '2020-01-01' and date '2099-12-31');

alter table public.todos
  add constraint todos_carry_from_date_range_check
    check (
      carry_from_date is null
      or carry_from_date between date '2020-01-01' and date '2099-12-31'
    );

-- 4) swap_todo_positions の改善:
--    SELECT FOR UPDATE で並列 swap をシリアライズ + user_id 明示検証
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

  -- FOR UPDATE で行をロック。同時に走る swap はここで順番待ち。
  -- ロック順は id の辞書順で取得しデッドロック (A↔B と B↔A の同時) を防ぐ。
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

  -- RLS で SELECT は自分の行のみ。not found なら exception。
  if user_a is null then
    raise exception 'todo not found: %', id_a using errcode = 'no_data_found';
  end if;
  if user_b is null then
    raise exception 'todo not found: %', id_b using errcode = 'no_data_found';
  end if;

  -- 防御深度: RLS が無効化されても他人の todo を触れない
  if user_a <> caller or user_b <> caller then
    raise exception 'permission denied' using errcode = 'insufficient_privilege';
  end if;

  if target_a is distinct from target_b or bucket_a is distinct from bucket_b then
    raise exception 'todos must be in the same (target_date, bucket)';
  end if;

  -- sentinel 経由で swap (UNIQUE 制約を一時回避)。
  -- 動的 sentinel として `pos_a + 1000000` を使う。同時に 2 つの swap が並列に
  -- 同 sentinel を取りに行ってもロック取得済みなのでシリアライズされる。
  update public.todos set position = -1000000 - pos_a where id = id_a;
  update public.todos set position = pos_a where id = id_b;
  update public.todos set position = pos_b where id = id_a;
end;
$$;

-- public/anon role からの実行を明示的に revoke (Supabase の public schema は
-- デフォルトで実行可能なため、防御深度として REVOKE しておく)
revoke execute on function public.swap_todo_positions(uuid, uuid) from public;
revoke execute on function public.swap_todo_positions(uuid, uuid) from anon;
grant execute on function public.swap_todo_positions(uuid, uuid) to authenticated;
