-- records.checks: 目標とタスクの完了チェック状態を保持する。
-- 例: { "goal": true, "task1": false, "task2": true, "task3": false }
-- フィールドキーは answers と同じ key を使う (goal, task1, weekGoal, ...)

alter table public.records
  add column checks jsonb not null default '{}'::jsonb;
