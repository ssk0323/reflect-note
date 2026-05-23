/** 1 日の行動リストとして使う ToDo 1 件の型。
 *  記録 (records / journal) とは別テーブル。 */

export type TodoBucket = "morning" | "forenoon" | "afternoon" | "night";

export const TODO_BUCKETS: TodoBucket[] = [
  "morning",
  "forenoon",
  "afternoon",
  "night",
];

export const TODO_BUCKET_LABEL: Record<TodoBucket, string> = {
  morning: "朝",
  forenoon: "午前",
  afternoon: "午後",
  night: "夜",
};

export type TodoRow = {
  id: string;
  /** いつの日の ToDo か (YYYY-MM-DD, JST) */
  target_date: string;
  text: string;
  bucket: TodoBucket;
  /** "HH:MM" 形式、または NULL */
  time: string | null;
  position: number;
  done: boolean;
  important: boolean;
  /** 引き継ぎ元の日付 (YYYY-MM-DD, JST)、または NULL */
  carry_from_date: string | null;
  created_at: string;
  updated_at: string;
};
