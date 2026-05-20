-- records: 朝/夜/週/月のリフレクション記録を保存
-- 1 ユーザー = 1 つの行集合。RLS で他人のデータが見えないようにする。

create table public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'morning',
      'night',
      'weeklyGoal',
      'weeklyReview',
      'monthlyGoal',
      'monthlyReview'
    )
  ),
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 一覧表示: 自分のレコードを新しい順
create index records_user_created_idx
  on public.records (user_id, created_at desc);

-- 種別フィルタ + 今週/今月の目標検索
create index records_user_type_created_idx
  on public.records (user_id, type, created_at desc);

-- updated_at を自動更新
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger records_touch_updated_at
  before update on public.records
  for each row execute function public.touch_updated_at();

-- RLS: ユーザーは自分の records だけ読み書き可能
alter table public.records enable row level security;

create policy "records: select own"
  on public.records for select
  using (auth.uid() = user_id);

create policy "records: insert own"
  on public.records for insert
  with check (auth.uid() = user_id);

create policy "records: update own"
  on public.records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "records: delete own"
  on public.records for delete
  using (auth.uid() = user_id);
