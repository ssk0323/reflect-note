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
  created_at: string;
  updated_at: string;
};
