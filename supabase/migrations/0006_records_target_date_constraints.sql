-- 0005 で追加した target_date に対する値域 CHECK 制約。
--
-- アプリ側の `normalizeTargetDate` は週 → 月曜・月 → 1 日 に丸めるが、
-- Supabase SDK を直叩きすると weeklyGoal target=水曜 のような不整合データが
-- INSERT 可能。集計ロジック (`resolveRecordDate` ベース) が壊れるので DB 側で
-- 防御する (PR #31 review で指摘あり)。
--
-- なお 0005 で作成した `records_user_type_target_date_idx` の CONCURRENTLY 化は
-- Supabase CLI が migration を transaction 内で実行する制約で本ファイルから
-- 実行できない。現在のデータ規模 (<<1000 行) では非 CONCURRENTLY の lock も
-- 短時間で済むため許容。本番運用で行数が増えた段階で別途、ダウンタイム枠の
-- 中で `psql` 直接実行による CONCURRENT 再構築を行う方針 (operational runbook
-- に記録)。

alter table public.records
  add constraint records_target_date_aligned check (
    target_date is null
    or type in ('morning', 'night')
    or (
      type in ('weeklyGoal', 'weeklyReview')
      and extract(isodow from target_date) = 1
    )
    or (
      type in ('monthlyGoal', 'monthlyReview')
      and extract(day from target_date) = 1
    )
  );
