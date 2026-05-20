import type { FlowAnswers, FlowType } from "@/lib/flows";

// records テーブルの 1 行に対応する型
export type RecordRow = {
  id: string;
  type: FlowType;
  answers: FlowAnswers;
  created_at: string;
  updated_at: string;
};
