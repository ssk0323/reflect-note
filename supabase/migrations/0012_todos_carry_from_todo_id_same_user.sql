-- PR #39 Copilot review round 8: carry_from_todo_id が他ユーザーの todo を
-- 参照できる問題を塞ぐ。
--
-- 0011 で `carry_from_todo_id uuid references public.todos(id) on delete set null`
-- を追加したが、FK 単体では「自分の row に他人の todo id を書き込める」状態。
-- これにより以下のクロスユーザー作用が成立してしまう:
--   (1) 任意の UUID が他ユーザーの todo として存在するかの "オラクル"
--       (FK 違反エラーの有無で判別可能)
--   (2) 他ユーザーが元 todo を delete すると ON DELETE SET NULL が cascade で
--       自分の row を書き換える
--
-- 解決策: INSERT / UPDATE の RLS WITH CHECK に「carry_from_todo_id が null か、
-- もしくは同一 user の todo を参照している」条件を加える。これで挿入時に
-- 他ユーザーの id を埋めることが物理的に不可能になり、(1) も (2) も成立しない。
--
-- 既存ポリシーは drop & re-create で WITH CHECK を差し替える。

drop policy if exists "todos_insert_own" on public.todos;
drop policy if exists "todos_update_own" on public.todos;

create policy "todos_insert_own"
  on public.todos for insert
  with check (
    auth.uid() = user_id
    and (
      carry_from_todo_id is null
      or exists (
        select 1 from public.todos src
        where src.id = carry_from_todo_id
          and src.user_id = auth.uid()
      )
    )
  );

create policy "todos_update_own"
  on public.todos for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      carry_from_todo_id is null
      or exists (
        select 1 from public.todos src
        where src.id = carry_from_todo_id
          and src.user_id = auth.uid()
      )
    )
  );
