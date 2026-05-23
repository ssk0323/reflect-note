import type { FlowAnswers, FlowType } from "@/lib/flows";

// 目標/タスクの完了チェック状態
// key は answers と同じキー (goal, task1, weekGoal, ...)
export type RecordChecks = Record<string, boolean>;

// records テーブルの 1 行に対応する型
export type RecordRow = {
  id: string;
  type: FlowType;
  answers: FlowAnswers;
  checks: RecordChecks;
  // いつのための記録か (YYYY-MM-DD, JST)。NULL のときは created_at の JST 日付を fallback。
  // 週/月フローでは「その週の月曜」「その月の 1 日」が入る (PR #31 で追加)。
  target_date: string | null;
  created_at: string;
  updated_at: string;
};
