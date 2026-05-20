// records.type の制約と一致させる (supabase/migrations/0001_create_records_table.sql)
export const FLOW_TYPES = [
  "morning",
  "night",
  "weeklyGoal",
  "weeklyReview",
  "monthlyGoal",
  "monthlyReview",
] as const;

export type FlowType = (typeof FLOW_TYPES)[number];

export type SingleQuestion = {
  kind: "input" | "textarea";
  key: string;
  title: string;
  helper: string;
  placeholder: string;
};

export type GroupField = {
  key: string;
  label: string;
  placeholder: string;
};

export type GroupQuestion = {
  kind: "group";
  key: string;
  title: string;
  helper: string;
  fields: GroupField[];
};

export type Question = SingleQuestion | GroupQuestion;

export type Flow = {
  type: FlowType;
  label: string;
  shortLabel: string;
  intro: string;
  questions: Question[];
};

// records.answers (JSONB) の中身。フラットな key → string で持つ
export type FlowAnswers = Record<string, string>;
