"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addDays,
  isValidDateString,
  toJstDateString,
} from "@/lib/records/targetDate";
import {
  TODO_BUCKETS,
  type TodoBucket,
  type TodoRow,
} from "@/lib/todos/types";

export type TodoResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "保存に失敗しました。時間をおいて再度お試しください。";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

function isBucket(v: unknown): v is TodoBucket {
  return typeof v === "string" && TODO_BUCKETS.includes(v as TodoBucket);
}

// 入力テキストの上限。DB 側で制約は無いが、極端な肥大化を防ぐためアプリ層で制限する。
const MAX_TEXT_LEN = 500;

function sanitizeText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LEN) return null;
  return trimmed;
}

function isValidTime(v: unknown): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "ログインが必要です", supabase, user: null };
  }
  return { ok: true as const, supabase, user };
}

// --------------------------------------------------------------------------
// Create
// --------------------------------------------------------------------------

export async function createTodo(input: {
  text: string;
  targetDate: string;
  bucket?: TodoBucket;
  time?: string | null;
  important?: boolean;
  carryFromDate?: string | null;
}): Promise<TodoResult> {
  const text = sanitizeText(input.text);
  if (!text) return { ok: false, error: "本文を入力してください" };
  if (!isValidDateString(input.targetDate)) {
    return { ok: false, error: "日付が不正です" };
  }
  const bucket: TodoBucket = isBucket(input.bucket) ? input.bucket : "forenoon";
  const time =
    input.time === null || input.time === undefined
      ? null
      : isValidTime(input.time)
        ? input.time
        : null;
  const important = input.important === true;
  const carryFromDate =
    input.carryFromDate && isValidDateString(input.carryFromDate)
      ? input.carryFromDate
      : null;

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  // position は同じ target_date + bucket の最大値 + 1
  const { data: maxRow, error: maxErr } = await auth.supabase
    .from("todos")
    .select("position")
    .eq("user_id", auth.user.id)
    .eq("target_date", input.targetDate)
    .eq("bucket", bucket)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    console.error("createTodo position lookup failed", maxErr);
    return { ok: false, error: GENERIC_ERROR };
  }
  const nextPos = (maxRow?.position ?? -1) + 1;

  const { error } = await auth.supabase.from("todos").insert({
    user_id: auth.user.id,
    target_date: input.targetDate,
    text,
    bucket,
    time,
    important,
    carry_from_date: carryFromDate,
    position: nextPos,
  });

  if (error) {
    console.error("createTodo insert failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Update text / bucket / time / important
// --------------------------------------------------------------------------

export async function updateTodo(
  id: string,
  patch: {
    text?: string;
    bucket?: TodoBucket;
    time?: string | null;
    important?: boolean;
  },
): Promise<TodoResult> {
  if (!isUuid(id)) return { ok: false, error: "id が不正です" };

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const update: Record<string, unknown> = {};
  if (patch.text !== undefined) {
    const text = sanitizeText(patch.text);
    if (!text) return { ok: false, error: "本文を入力してください" };
    update.text = text;
  }
  if (patch.bucket !== undefined) {
    if (!isBucket(patch.bucket)) return { ok: false, error: "bucket が不正です" };
    update.bucket = patch.bucket;
  }
  if (patch.time !== undefined) {
    if (patch.time === null) update.time = null;
    else if (isValidTime(patch.time)) update.time = patch.time;
    else return { ok: false, error: "時刻が不正です" };
  }
  if (patch.important !== undefined) {
    update.important = patch.important === true;
  }

  if (Object.keys(update).length === 0) return { ok: true }; // no-op

  const { data, error } = await auth.supabase
    .from("todos")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error) {
    console.error("updateTodo failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象の ToDo が見つかりません" };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Toggle done
// --------------------------------------------------------------------------

export async function toggleTodoDone(
  id: string,
  next: boolean,
): Promise<TodoResult> {
  if (!isUuid(id)) return { ok: false, error: "id が不正です" };
  if (typeof next !== "boolean") {
    return { ok: false, error: "状態が不正です" };
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase
    .from("todos")
    .update({ done: next })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error) {
    console.error("toggleTodoDone failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象の ToDo が見つかりません" };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Reorder (move up / down within same target_date)
// --------------------------------------------------------------------------

export async function reorderTodo(
  id: string,
  direction: "up" | "down",
): Promise<TodoResult> {
  if (!isUuid(id)) return { ok: false, error: "id が不正です" };
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "direction が不正です" };
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  // 対象 ToDo の position / target_date / bucket を取得
  const { data: current, error: fetchErr } = await auth.supabase
    .from("todos")
    .select("id, target_date, bucket, position")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("reorderTodo fetch failed", fetchErr);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!current) return { ok: false, error: "対象の ToDo が見つかりません" };

  // 同じ target_date + bucket 内で隣の ToDo を探して position を swap
  const cmp = direction === "up" ? "lt" : "gt";
  const order = direction === "up" ? false : true; // up: 大きい順で 1 件 / down: 小さい順で 1 件
  const { data: neighbor, error: nErr } = await auth.supabase
    .from("todos")
    .select("id, position")
    .eq("user_id", auth.user.id)
    .eq("target_date", current.target_date)
    .eq("bucket", current.bucket)
    [cmp]("position", current.position)
    .order("position", { ascending: order })
    .limit(1)
    .maybeSingle();

  if (nErr) {
    console.error("reorderTodo neighbor lookup failed", nErr);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!neighbor) return { ok: true }; // 既に端

  // ATOMIC な swap が理想だが、現状は 2 回 UPDATE で許容 (P2 で RPC 化を検討)
  const { error: e1 } = await auth.supabase
    .from("todos")
    .update({ position: neighbor.position })
    .eq("id", current.id)
    .eq("user_id", auth.user.id);
  if (e1) {
    console.error("reorderTodo step1 failed", e1);
    return { ok: false, error: GENERIC_ERROR };
  }
  const { error: e2 } = await auth.supabase
    .from("todos")
    .update({ position: current.position })
    .eq("id", neighbor.id)
    .eq("user_id", auth.user.id);
  if (e2) {
    console.error("reorderTodo step2 failed", e2);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Delete
// --------------------------------------------------------------------------

export async function deleteTodo(id: string): Promise<TodoResult> {
  if (!isUuid(id)) return { ok: false, error: "id が不正です" };

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error) {
    console.error("deleteTodo failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象の ToDo が見つかりません" };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Carry to tomorrow (夜の「→ 明日」)
// --------------------------------------------------------------------------

export async function carryTodoToTomorrow(
  id: string,
): Promise<TodoResult> {
  if (!isUuid(id)) return { ok: false, error: "id が不正です" };

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  // 対象 ToDo を取得
  const { data: src, error: fetchErr } = await auth.supabase
    .from("todos")
    .select("id, target_date, text, bucket, time, important")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("carryTodoToTomorrow fetch failed", fetchErr);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!src) return { ok: false, error: "対象の ToDo が見つかりません" };

  const tomorrow = addDays(src.target_date, 1);

  // 翌日の同 bucket の position 最大 +1
  const { data: maxRow } = await auth.supabase
    .from("todos")
    .select("position")
    .eq("user_id", auth.user.id)
    .eq("target_date", tomorrow)
    .eq("bucket", src.bucket as TodoBucket)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (maxRow?.position ?? -1) + 1;

  const { error: insErr } = await auth.supabase.from("todos").insert({
    user_id: auth.user.id,
    target_date: tomorrow,
    text: src.text,
    bucket: src.bucket as TodoBucket,
    time: src.time,
    important: src.important,
    carry_from_date: src.target_date,
    position: nextPos,
  });

  if (insErr) {
    console.error("carryTodoToTomorrow insert failed", insErr);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Helpers for the page (reading)
// --------------------------------------------------------------------------

/** 今日 (JST) の ToDo を position 順で全件取得。 */
export async function fetchTodosForDate(
  date: string,
): Promise<{ todos: TodoRow[]; error: string | null }> {
  if (!isValidDateString(date)) {
    return { todos: [], error: "日付が不正です" };
  }
  const auth = await requireAuth();
  if (!auth.ok) return { todos: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("todos")
    .select(
      "id, target_date, text, bucket, time, position, done, important, carry_from_date, created_at, updated_at",
    )
    .eq("user_id", auth.user.id)
    .eq("target_date", date)
    .order("position", { ascending: true })
    .limit(200);

  if (error) {
    console.error("fetchTodosForDate failed", error);
    return { todos: [], error: GENERIC_ERROR };
  }
  return { todos: (data ?? []) as TodoRow[], error: null };
}

/** 昨日 (JST) の未完了 ToDo を取得 (朝の「引き継ぎ提案」用)。 */
export async function fetchYesterdayPendingTodos(
  todayDate: string,
): Promise<{ todos: TodoRow[]; error: string | null }> {
  if (!isValidDateString(todayDate)) {
    return { todos: [], error: "日付が不正です" };
  }
  const yesterday = addDays(todayDate, -1);
  const auth = await requireAuth();
  if (!auth.ok) return { todos: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("todos")
    .select(
      "id, target_date, text, bucket, time, position, done, important, carry_from_date, created_at, updated_at",
    )
    .eq("user_id", auth.user.id)
    .eq("target_date", yesterday)
    .eq("done", false)
    .order("position", { ascending: true });

  if (error) {
    console.error("fetchYesterdayPendingTodos failed", error);
    return { todos: [], error: GENERIC_ERROR };
  }
  return { todos: (data ?? []) as TodoRow[], error: null };
}

/** 「2 件追加」のように一括で carry を実行する。 */
export async function acceptCarryProposal(
  ids: string[],
  todayDate: string,
): Promise<TodoResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "対象がありません" };
  }
  if (!ids.every(isUuid)) {
    return { ok: false, error: "id に不正な値があります" };
  }
  if (!isValidDateString(todayDate)) {
    return { ok: false, error: "日付が不正です" };
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  // 元 ToDo を取得 (RLS + user_id で他人のレコードは取れない)
  const { data: sources, error: fetchErr } = await auth.supabase
    .from("todos")
    .select("id, target_date, text, bucket, time, important")
    .in("id", ids)
    .eq("user_id", auth.user.id);

  if (fetchErr) {
    console.error("acceptCarryProposal fetch failed", fetchErr);
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!sources || sources.length === 0) {
    return { ok: false, error: "対象の ToDo が見つかりません" };
  }

  // 全部 forenoon に流し込み、position は連番。重複防止のため
  // target_date + carry_from_date でユニークチェックは省略 (再実行で重複し得る点は UX 上 OK)。
  const { data: maxRow } = await auth.supabase
    .from("todos")
    .select("position")
    .eq("user_id", auth.user.id)
    .eq("target_date", todayDate)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = (maxRow?.position ?? -1) + 1;

  const inserts = sources.map((s) => ({
    user_id: auth.user.id,
    target_date: todayDate,
    text: s.text,
    bucket: (s.bucket as TodoBucket) ?? "forenoon",
    time: s.time,
    important: s.important,
    carry_from_date: s.target_date,
    position: pos++,
  }));

  const { error: insErr } = await auth.supabase.from("todos").insert(inserts);
  if (insErr) {
    console.error("acceptCarryProposal insert failed", insErr);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/");
  return { ok: true };
}

// today の JST 日付を返すヘルパー (page.tsx から取り回しやすいよう server 側に置く)
export async function getTodayJstDate(): Promise<string> {
  return toJstDateString(new Date());
}
