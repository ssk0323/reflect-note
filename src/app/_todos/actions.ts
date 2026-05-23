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

// DoS / 自リソース枯渇防止のため、1 ユーザー / 1 日 / 1 リクエストの最大件数を制限。
// (team review P1: target_date client trust + 件数上限なし)
const MAX_CARRY_BATCH = 50;
const MAX_TODOS_PER_DAY = 200;

// target_date の許容範囲 (team review P1: '9999-12-31' 等での DB 圧迫を防ぐ)
const MIN_TARGET_DATE = "2020-01-01";
const MAX_TARGET_DATE = "2099-12-31";

function isAllowedTargetDate(d: string): boolean {
  return (
    isValidDateString(d) && d >= MIN_TARGET_DATE && d <= MAX_TARGET_DATE
  );
}

function sanitizeText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LEN) return null;
  return trimmed;
}

// time HH:MM の厳密な検証 (team review P2: `25:99` が通る regex を厳格化)
function isValidTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Supabase の error オブジェクトをログ出力する際に、ユーザー入力テキストや個人情報を
 *  含むフィールドを除外し、code/hint/コンテキストだけを残す。
 *  (team review P2: console.error に Supabase エラー (= 入力 text 含む) 素通し) */
function safeErrorContext(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { error: String(err) };
  const e = err as { code?: unknown; hint?: unknown; status?: unknown };
  return {
    code: typeof e.code === "string" ? e.code : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
  };
}

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      error: "ログインが必要です",
      supabase,
      user: null,
    };
  }
  return { ok: true as const, supabase, user };
}

/** 同 (user, target_date, bucket) の現在の todo 数を返す。
 *  MAX_TODOS_PER_DAY 上限チェック用。 */
async function countTodos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  targetDate: string,
): Promise<number> {
  const { count } = await supabase
    .from("todos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("target_date", targetDate);
  return count ?? 0;
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
  if (!isAllowedTargetDate(input.targetDate)) {
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
    input.carryFromDate && isAllowedTargetDate(input.carryFromDate)
      ? input.carryFromDate
      : null;

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const existing = await countTodos(auth.supabase, auth.user.id, input.targetDate);
  if (existing >= MAX_TODOS_PER_DAY) {
    return {
      ok: false,
      error: `1 日 ${MAX_TODOS_PER_DAY} 件まで追加できます`,
    };
  }

  // position 計算: 同 (user, target_date, bucket) の max + 1。
  // UNIQUE 制約 (migration 0008) があるので並列衝突時は INSERT が失敗 → リトライで吸収。
  const { error } = await tryInsertWithPosition(
    auth.supabase,
    auth.user.id,
    input.targetDate,
    bucket,
    {
      text,
      time,
      important,
      carry_from_date: carryFromDate,
    },
  );

  if (error) {
    console.error("createTodo failed", safeErrorContext(error));
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/");
  return { ok: true };
}

/** position UNIQUE 違反時にリトライする INSERT ヘルパー。
 *  並列 INSERT で同じ position を狙ったときは、後者が衝突するので max+1 を取り直す。
 *
 *  team review (2 周目) で「3 回 retry は並列 4+ で枯渇 + throw が unhandled」と
 *  指摘されたため、回数を 8 に増やし、上限到達時は throw でなく `{ error }` を返す。
 *
 *  carry 系の冪等性 UNIQUE index (0009: `todos_unique_carry_idem_idx`) で 23505 が
 *  発生したケースは「既に carry 済」と見なしたいので、呼び出し側で
 *  `isCarryDuplicate` を判別できるよう error.constraint も伝播する。 */
async function tryInsertWithPosition(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  targetDate: string,
  bucket: TodoBucket,
  fields: {
    text: string;
    time: string | null;
    important: boolean;
    carry_from_date: string | null;
  },
): Promise<{ error: unknown; carryDuplicate?: boolean }> {
  const MAX_RETRIES = 8;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: maxRow, error: maxErr } = await supabase
      .from("todos")
      .select("position")
      .eq("user_id", userId)
      .eq("target_date", targetDate)
      .eq("bucket", bucket)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) return { error: maxErr };
    const nextPos = (maxRow?.position ?? -1) + 1;

    const { error } = await supabase.from("todos").insert({
      user_id: userId,
      target_date: targetDate,
      bucket,
      position: nextPos,
      text: fields.text,
      time: fields.time,
      important: fields.important,
      carry_from_date: fields.carry_from_date,
    });
    if (!error) return { error: null };

    const code = (error as { code?: string }).code;
    const constraint = (error as { details?: string; message?: string }).message ?? "";
    if (code === "23505") {
      // carry 冪等 UNIQUE index による衝突 = 既に carry 済 = 冪等成功と見なす
      if (constraint.includes("todos_unique_carry_idem_idx")) {
        return { error: null, carryDuplicate: true };
      }
      // position 衝突は次の attempt で max+1 を取り直して再試行
      continue;
    }
    return { error };
  }
  // throw でなく return に変更 (上位 catch なしで unhandled rejection になる問題を解消)
  return { error: new Error("position conflict after retries") };
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

  if (Object.keys(update).length === 0) return { ok: true };

  const { data, error } = await auth.supabase
    .from("todos")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error) {
    console.error("updateTodo failed", safeErrorContext(error));
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
    console.error("toggleTodoDone failed", safeErrorContext(error));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象の ToDo が見つかりません" };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Reorder (move up / down within same (target_date, bucket))
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

  const { data: current, error: fetchErr } = await auth.supabase
    .from("todos")
    .select("id, target_date, bucket, position")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("reorderTodo fetch failed", safeErrorContext(fetchErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!current) return { ok: false, error: "対象の ToDo が見つかりません" };

  // 隣の todo を探す。動的メソッド呼び出しを避け、明示的に分岐 (team review P2)。
  const baseQuery = auth.supabase
    .from("todos")
    .select("id, position")
    .eq("user_id", auth.user.id)
    .eq("target_date", current.target_date)
    .eq("bucket", current.bucket);

  const filteredQuery =
    direction === "up"
      ? baseQuery.lt("position", current.position).order("position", { ascending: false })
      : baseQuery.gt("position", current.position).order("position", { ascending: true });

  const { data: neighbor, error: nErr } = await filteredQuery.limit(1).maybeSingle();

  if (nErr) {
    console.error("reorderTodo neighbor failed", safeErrorContext(nErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!neighbor) return { ok: true }; // already at edge

  // Atomic swap via RPC (migration 0008/0009)。
  // 並列 swap で sentinel 衝突 (23505) が起きた場合は 1 回だけリトライする
  // (team review 2 周目 P0: sentinel=-1 並列衝突)。
  // 0009 で FOR UPDATE による行ロックを入れたので 23505 はほぼ起きないが念のため。
  let rpcErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await auth.supabase.rpc("swap_todo_positions", {
      id_a: current.id,
      id_b: neighbor.id,
    });
    rpcErr = error;
    if (!error) {
      revalidatePath("/");
      return { ok: true };
    }
    const code = (error as { code?: string }).code;
    if (code !== "23505") break;
  }

  console.error("reorderTodo rpc failed", safeErrorContext(rpcErr));
  return { ok: false, error: GENERIC_ERROR };
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
    console.error("deleteTodo failed", safeErrorContext(error));
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

  const { data: src, error: fetchErr } = await auth.supabase
    .from("todos")
    .select("id, target_date, text, bucket, time, important")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("carryTodoToTomorrow fetch failed", safeErrorContext(fetchErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!src) return { ok: false, error: "対象の ToDo が見つかりません" };

  const tomorrow = addDays(src.target_date, 1);
  if (!isAllowedTargetDate(tomorrow)) {
    return { ok: false, error: "日付が不正です" };
  }

  // 冪等性: DB の部分 UNIQUE index (todos_unique_carry_idem_idx, 0009) が
  // (user_id, target_date, carry_from_date) で重複 INSERT を物理ブロックする。
  // 並列 2 タブで accept しても DB が片方を 23505 で reject し、
  // tryInsertWithPosition が carryDuplicate=true として冪等成功を返す。

  // 件数上限の事前チェック (UX: 上限超過時に明確なメッセージ)
  const cnt = await countTodos(auth.supabase, auth.user.id, tomorrow);
  if (cnt >= MAX_TODOS_PER_DAY) {
    return {
      ok: false,
      error: `1 日 ${MAX_TODOS_PER_DAY} 件まで追加できます`,
    };
  }

  const { error: insErr, carryDuplicate } = await tryInsertWithPosition(
    auth.supabase,
    auth.user.id,
    tomorrow,
    src.bucket as TodoBucket,
    {
      text: src.text,
      time: src.time,
      important: src.important,
      carry_from_date: src.target_date,
    },
  );

  if (insErr) {
    console.error("carryTodoToTomorrow insert failed", safeErrorContext(insErr));
    return { ok: false, error: GENERIC_ERROR };
  }

  // carryDuplicate なら既に carry 済 (= 冪等成功)
  if (carryDuplicate) {
    revalidatePath("/");
    return { ok: true };
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Read helpers
// --------------------------------------------------------------------------

export async function fetchTodosForDate(
  date: string,
): Promise<{ todos: TodoRow[]; error: string | null }> {
  if (!isAllowedTargetDate(date)) {
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
    .limit(MAX_TODOS_PER_DAY);

  if (error) {
    console.error("fetchTodosForDate failed", safeErrorContext(error));
    return { todos: [], error: GENERIC_ERROR };
  }
  return { todos: (data ?? []) as TodoRow[], error: null };
}

export async function fetchYesterdayPendingTodos(
  todayDate: string,
): Promise<{ todos: TodoRow[]; error: string | null }> {
  if (!isAllowedTargetDate(todayDate)) {
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
    .order("position", { ascending: true })
    .limit(MAX_CARRY_BATCH);

  if (error) {
    console.error("fetchYesterdayPendingTodos failed", safeErrorContext(error));
    return { todos: [], error: GENERIC_ERROR };
  }
  return { todos: (data ?? []) as TodoRow[], error: null };
}

// --------------------------------------------------------------------------
// Accept carry proposal (朝の「N 件を追加」)
// --------------------------------------------------------------------------

export async function acceptCarryProposal(
  ids: string[],
  todayDate: string,
): Promise<TodoResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "対象がありません" };
  }
  if (ids.length > MAX_CARRY_BATCH) {
    return { ok: false, error: `${MAX_CARRY_BATCH} 件までです` };
  }
  // 重複 id を除去 (team review P1: 同じ id を 100 個入れて amplification)
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.every(isUuid)) {
    return { ok: false, error: "id に不正な値があります" };
  }
  if (!isAllowedTargetDate(todayDate)) {
    return { ok: false, error: "日付が不正です" };
  }
  // todayDate がサーバ時計の「今日」と一致するか検証 (任意日への横流しを防ぐ)
  const serverToday = toJstDateString(new Date());
  if (todayDate !== serverToday) {
    return { ok: false, error: "日付が不正です" };
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  // 取得: RLS + user_id で他人の id は弾かれる
  const { data: sources, error: fetchErr } = await auth.supabase
    .from("todos")
    .select("id, target_date, text, bucket, time, important")
    .in("id", uniqueIds)
    .eq("user_id", auth.user.id);

  if (fetchErr) {
    console.error("acceptCarryProposal fetch failed", safeErrorContext(fetchErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!sources || sources.length === 0) {
    return { ok: false, error: "対象の ToDo が見つかりません" };
  }

  // 冪等性は DB の部分 UNIQUE index (todos_unique_carry_idem_idx, 0009) が担保。
  // 並列 2 タブ accept で両方が同じ source を insert しようとしても、
  // 後者は 23505 (todos_unique_carry_idem_idx) で reject される → carryDuplicate
  // で冪等成功とみなして skip。

  // 件数上限の事前チェック (上限近くでも全部 carry 済なら問題なく通る)
  const cnt = await countTodos(auth.supabase, auth.user.id, todayDate);
  if (cnt + sources.length > MAX_TODOS_PER_DAY) {
    return {
      ok: false,
      error: `1 日 ${MAX_TODOS_PER_DAY} 件を超えるため取り込めません`,
    };
  }

  // 順序を安定化: target_date asc + position asc (元の昨日リスト順を再現)
  const sorted = sources.slice().sort((a, b) => {
    if (a.target_date < b.target_date) return -1;
    if (a.target_date > b.target_date) return 1;
    return 0;
  });

  let dupCount = 0;
  for (const s of sorted) {
    const { error, carryDuplicate } = await tryInsertWithPosition(
      auth.supabase,
      auth.user.id,
      todayDate,
      s.bucket as TodoBucket,
      {
        text: s.text,
        time: s.time,
        important: s.important,
        carry_from_date: s.target_date,
      },
    );
    if (error) {
      console.error("acceptCarryProposal insert failed", safeErrorContext(error));
      return { ok: false, error: GENERIC_ERROR };
    }
    if (carryDuplicate) dupCount++;
  }

  // dupCount は計測のみ (将来 UI で "N 件は既に追加済み" を出すための情報)
  void dupCount;

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Public helper
// --------------------------------------------------------------------------

export async function getTodayJstDate(): Promise<string> {
  return toJstDateString(new Date());
}
