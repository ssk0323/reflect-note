-- todos: 「本日の ToDo リスト」を管理する。
-- 朝のセットアップで作成した task1-3 (★大事な3つ) も含めて、
-- 当日中はこのテーブルが Home 画面の主役データになる。
--
-- 既存の records テーブルは「ジャーナル/振り返り」用途として残し、
-- todos は「行動リスト」用途として分離する (記録の意味付けが異なるため)。

create type public.todo_bucket as enum ('morning', 'forenoon', 'afternoon', 'night');

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- いつの日の ToDo か (JST, YYYY-MM-DD)。記録の created_at とは別に持つ。
  target_date date not null,
  -- タスク本文
  text text not null,
  -- 時間バケット (朝/午前/午後/夜)。デフォルトは forenoon。
  bucket public.todo_bucket not null default 'forenoon',
  -- 任意で具体時刻 (例: '14:00')。NULL なら bucket だけで表示。
  time time null,
  -- 同じ target_date 内の表示順。↑↓ ボタンで position を swap する。
  position integer not null default 0,
  -- 完了フラグ
  done boolean not null default false,
  -- 「大事な 3 つ」フラグ。朝のセットアップで選んだ ★ を表す。
  important boolean not null default false,
  -- 引き継ぎ元の target_date (NULL なら今日作成された ToDo)
  carry_from_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 「自分の今日の ToDo を position 順で並べる」が主要クエリ。
create index todos_user_target_position_idx
  on public.todos (user_id, target_date, position);

-- updated_at を自動更新 (既存の touch_updated_at 関数を流用)
create trigger todos_touch_updated_at
  before update on public.todos
  for each row execute function public.touch_updated_at();

-- RLS: 自分の todos のみ操作可能
alter table public.todos enable row level security;

create policy "todos_select_own"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "todos_insert_own"
  on public.todos for insert
  with check (auth.uid() = user_id);

create policy "todos_update_own"
  on public.todos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "todos_delete_own"
  on public.todos for delete
  using (auth.uid() = user_id);
