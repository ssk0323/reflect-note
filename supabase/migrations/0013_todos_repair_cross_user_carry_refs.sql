-- PR #39 Copilot review round 10: 0012 適用以前に存在し得た「他ユーザーの
-- todo を carry_from_todo_id で参照する不正な行」を defensive に修復する。
--
-- 0011 で carry_from_todo_id を追加したが、その時点では FK 制約のみで
-- 同一 user 制約がなかった。0012 で RLS WITH CHECK を強化したが、これは
-- 「これから書き込まれる」値しか防げない。既存の不正参照は残ったままで、
-- 次の 2 つの実害が残る:
--
--   (1) 他ユーザーが元 todo を delete すると、FK の ON DELETE SET NULL が
--       cascade で「自分の行」を書き換える (RLS は cascade に効かない)。
--   (2) 0012 の新 WITH CHECK で carry_from_todo_id を変更しない通常 UPDATE
--       (done のトグルや position の並び替え) でも policy が再評価され、
--       既存の不正参照値が条件を満たさないため UPDATE が拒否される
--       (= 既存行が更新不能になる)。
--
-- 解決策: 「自分の user_id と異なる todo を参照している carry_from_todo_id」を
-- NULL に直す repair UPDATE を入れる。元 todo が消えていれば NULL のまま、
-- 存在しても他者所有なら参照を切る。NULL は部分 UNIQUE index の対象外なので
-- todos_unique_carry_idem_idx にも影響しない。

update public.todos t
set carry_from_todo_id = null
where t.carry_from_todo_id is not null
  and (
    -- 参照先 todo が存在しない or 他ユーザー所有なら NULL に
    not exists (
      select 1 from public.todos src
      where src.id = t.carry_from_todo_id
        and src.user_id = t.user_id
    )
  );
