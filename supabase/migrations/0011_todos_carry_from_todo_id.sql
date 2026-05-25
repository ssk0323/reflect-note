-- PR #39 Copilot review round 6: carry の冪等性キーを「日付単位」から
-- 「ToDo 単位」に変更する。
--
-- 0009 で導入した `todos_unique_carry_idem_idx (user_id, target_date, carry_from_date)`
-- は同じ source_date から複数の ToDo を carry することを物理ブロックしていた。
-- これは「昨日の未完了 3 件をまとめて今日に carry」という UI 仕様
-- (朝の提案カードで N 件追加 / 個別 carry ボタン両方) を破壊する設計バグ。
--
-- 解決策: `carry_from_todo_id` 列を追加し UNIQUE をその単位に張り直す。
-- 「同じ source ToDo を同じ日に 2 重 carry」だけが冪等性違反 = 既存 carry の重複。
-- 一方で「異なる source ToDo を carry」は別行として共存できる。
--
-- 表示用の `carry_from_date` 列はそのまま残す ("<日付>から繰り越し" ラベル用)。
-- carry 元 ToDo が削除されたら `carry_from_todo_id` は NULL になるが、
-- `carry_from_date` は残るので「いつから来たか」は引き続き表示可能。

-- 1) carry_from_todo_id 列を追加 (FK; 元 todo 削除時は SET NULL)
alter table public.todos
  add column carry_from_todo_id uuid
    references public.todos(id) on delete set null;

-- 2) 旧 (日付単位) の冪等 UNIQUE を drop
drop index public.todos_unique_carry_idem_idx;

-- 3) ToDo 単位の部分 UNIQUE を作成
--    (user_id, target_date, carry_from_todo_id) で同じ source ToDo を 2 重に
--    carry できない。並列 2 タブで同じ todo を accept しても DB が後者を 23505 で
--    reject し、tryInsertWithPosition が carryDuplicate=true として冪等成功を返す。
--    既存行で carry_from_todo_id が null のものは部分 index 対象外なので衝突しない。
create unique index todos_unique_carry_idem_idx
  on public.todos (user_id, target_date, carry_from_todo_id)
  where carry_from_todo_id is not null;
