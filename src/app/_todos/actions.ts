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

// 入力テキストの上限。DB 側にも CHECK 制約 (`todos_text_length_check`, 0009)
// があるが、UX のため (Supabase の 23514 エラーをそのまま投げない) アプリ層でも
// 同じ閾値で弾く。両者を同期して変更すること。
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
 *  (team review P2: console.error に Supabase エラー (= 入力 text 含む) 素通し)
 *
 *  Round 8 Copilot review: アプリ内生成 Error (例: `new Error("position conflict
 *  after retries")`) は Supabase 由来ではないので message に PII は含まれず、
 *  落とすと原因調査が困難になる。`err instanceof Error` かつ `code` を持たない
 *  ケース (= 我々のコードが投げた Error) に限り name / message を残す。
 *  Supabase の PostgrestError は newer 版で Error を継承する場合もあるが、
 *  `code` を必ず持つので分岐が成立する。 */
function safeErrorContext(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { error: String(err) };
  const e = err as { code?: unknown; hint?: unknown; status?: unknown };
  const result: Record<string, unknown> = {
    code: typeof e.code === "string" ? e.code : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
  };
  if (err instanceof Error && typeof e.code !== "string") {
    result.appErrorName = err.name;
    result.appErrorMessage = err.message;
  }
  return result;
}

type AuthOk = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string };
};
type AuthFail = { ok: false; error: string };

/** 認証チェック。`ok: false` のときは error のみを返す (Server Action の戻り値に
 *  非シリアライズ可能な supabase client が混入しないようにする — Copilot review)。 */
async function requireAuth(): Promise<AuthOk | AuthFail> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }
  return { ok: true, supabase, user: { id: user.id } };
}

/** user_id × target_date 単位での todo 件数を返す (bucket は問わない、日全体)。
 *  MAX_TODOS_PER_DAY (200) 上限チェック用。
 *
 *  Round 7 Copilot review: count 取得で error が出ても無視して 0 返しすると、
 *  DB/network 障害時に上限チェックが silent に無効化されて後続 INSERT が
 *  予期せぬ別エラーになる。`{ count, error }` を返して呼び出し側で安全側に
 *  失敗できるようにする。 */
async function countTodos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  targetDate: string,
): Promise<{ count: number; error: unknown }> {
  const { count, error } = await supabase
    .from("todos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("target_date", targetDate);
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

// --------------------------------------------------------------------------
// Create
// --------------------------------------------------------------------------

export async function createTodo(input: {
  /** PR #45 review: 楽観 UI 用に client 側で生成した UUID を受け付ける。
   *  渡されない場合は DB の uuid default で server 側生成。 */
  id?: string;
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
  // time は null/undefined なら NULL、それ以外は形式検証してエラーにする。
  // updateTodo と挙動を揃える (Copilot review: silent null は誤入力に気づけない)。
  let time: string | null;
  if (input.time === null || input.time === undefined) {
    time = null;
  } else if (isValidTime(input.time)) {
    time = input.time;
  } else {
    return { ok: false, error: "時刻が不正です" };
  }
  const important = input.important === true;
  const carryFromDate =
    input.carryFromDate && isAllowedTargetDate(input.carryFromDate)
      ? input.carryFromDate
      : null;

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const { count: existing, error: countErr } = await countTodos(
    auth.supabase,
    auth.user.id,
    input.targetDate,
  );
  if (countErr) {
    console.error("createTodo count failed", safeErrorContext(countErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (existing >= MAX_TODOS_PER_DAY) {
    return {
      ok: false,
      error: `1 日 ${MAX_TODOS_PER_DAY} 件まで追加できます`,
    };
  }

  // 任意の client UUID を受け付ける (楽観 UI 用)。形式不正なら拒否。
  const optionalId = input.id !== undefined && input.id !== null
    ? isUuid(input.id) ? input.id : null
    : undefined;
  if (input.id !== undefined && input.id !== null && optionalId === null) {
    return { ok: false, error: "id が不正です" };
  }

  // position 計算: 同 (user, target_date, bucket) の max + 1。
  // UNIQUE 制約 (migration 0008) があるので並列衝突時は INSERT が失敗 → リトライで吸収。
  const { error } = await tryInsertWithPosition(
    auth.supabase,
    auth.user.id,
    input.targetDate,
    bucket,
    {
      id: optionalId ?? undefined,
      text,
      time,
      important,
      carry_from_date: carryFromDate,
      // 通常 create では carry idem キーは無し (carry 経路でのみ立てる)
      carry_from_todo_id: null,
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
 *  発生したケースは「既に carry 済」と見なしたいので、戻り値に
 *  `carryDuplicate: true` を立てて呼び出し側に伝える (constraint 名そのものは
 *  伝播せず、error.message に含まれる名前を内部で見て判定するのみ)。 */
async function tryInsertWithPosition(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  targetDate: string,
  bucket: TodoBucket,
  fields: {
    /** 任意の client 側 UUID。未指定なら DB の default で生成される (楽観 UI 用)。 */
    id?: string;
    text: string;
    time: string | null;
    important: boolean;
    carry_from_date: string | null;
    /** 冪等性キー (Round 6 review): null なら carry idem index 対象外。 */
    carry_from_todo_id: string | null;
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

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      target_date: targetDate,
      bucket,
      position: nextPos,
      text: fields.text,
      time: fields.time,
      important: fields.important,
      carry_from_date: fields.carry_from_date,
      carry_from_todo_id: fields.carry_from_todo_id,
    };
    if (fields.id) insertPayload.id = fields.id;
    const { error } = await supabase.from("todos").insert(insertPayload);
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

  // Issue #40: bucket を変える場合は新 bucket の末尾 position に再採番する必要がある。
  // UNIQUE(user_id, target_date, bucket, position) で既存 position と衝突しうるため、
  // 同じ position のまま bucket だけ変えると 23505 になる。
  //
  // PR #41 review (Copilot + Codex): 並行 update で `max(position)+1` が
  // 衝突しうるため、UPDATE 単発ではなく「max 取得 → UPDATE → 23505 なら retry」の
  // ループ (tryInsertWithPosition と同じパターン) に。
  if (patch.bucket !== undefined) {
    // 対象 todo の (target_date, 現 bucket) を取得 (RLS で他人の todo は弾かれる)
    const { data: src, error: srcErr } = await auth.supabase
      .from("todos")
      .select("target_date, bucket")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (srcErr) {
      console.error("updateTodo bucket fetch failed", safeErrorContext(srcErr));
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!src) return { ok: false, error: "対象の ToDo が見つかりません" };

    // bucket が同じなら position 再採番は不要 (= 通常 update 経路)
    if (src.bucket === patch.bucket) {
      // 何もしない — 下の単発 UPDATE に流れる
    } else {
      const MAX_RETRIES = 8;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { data: maxRow, error: maxErr } = await auth.supabase
          .from("todos")
          .select("position")
          .eq("user_id", auth.user.id)
          .eq("target_date", src.target_date)
          .eq("bucket", patch.bucket)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (maxErr) {
          console.error("updateTodo bucket max-pos failed", safeErrorContext(maxErr));
          return { ok: false, error: GENERIC_ERROR };
        }
        update.position = (maxRow?.position ?? -1) + 1;

        const { data, error } = await auth.supabase
          .from("todos")
          .update(update)
          .eq("id", id)
          .eq("user_id", auth.user.id)
          .select("id");
        if (!error) {
          if (!data || data.length === 0) {
            return { ok: false, error: "対象の ToDo が見つかりません" };
          }
          revalidatePath("/");
          return { ok: true };
        }
        lastErr = error;
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          // 並行 update で max が古くなった → 取り直して retry
          continue;
        }
        // それ以外のエラーは即返却
        console.error("updateTodo failed", safeErrorContext(error));
        return { ok: false, error: GENERIC_ERROR };
      }
      console.error(
        "updateTodo bucket retry exhausted",
        safeErrorContext(lastErr),
      );
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  // bucket 変更ナシ or bucket が同一の通常 UPDATE 経路
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

  // Atomic swap via RPC (migration 0010)。
  // 0010 で UNIQUE(user_id, target_date, bucket, position) を DEFERRABLE INITIALLY
  // DEFERRED に変更し、RPC 内部は sentinel を使わず 2 回の UPDATE で
  // (a→b, b→a) を 1 トランザクション内に納めるよう刷新済み。COMMIT 時に
  // 制約が再評価されるので一時的な重複は許容され、sentinel 衝突 (23505) は
  // 発生しなくなった (0008/0009 当時の sentinel=-1 / sentinel=-1000000-pos
  // アプローチは過去のもの)。
  //
  // ただし行ロック (FOR UPDATE) を取る前に並列 RPC が他行と衝突するケースが
  // 残る可能性が理論上ゼロではないため、23505 のみ 1 回だけリトライする
  // (deadlock 40P01 はリトライ対象外: PostgreSQL がトランザクションを abort
  // させるためリトライしてもすぐ別のロック競合に当たる)。
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
// Move to arbitrary (bucket, position) (Issue #44)
// --------------------------------------------------------------------------

/** ハンドル drag (`@dnd-kit`) で任意の (bucket × position) に移動するための
 *  server action。move_todo RPC (migration 0014) で position 再採番を atomic に行う。
 *  bucket 間の移動と任意 position への挿入をどちらも扱う。 */
export async function moveTodo(
  id: string,
  targetBucket: TodoBucket,
  targetPosition: number,
): Promise<TodoResult> {
  if (!isUuid(id)) return { ok: false, error: "id が不正です" };
  if (!isBucket(targetBucket)) {
    return { ok: false, error: "bucket が不正です" };
  }
  if (!Number.isInteger(targetPosition) || targetPosition < 0) {
    return { ok: false, error: "position が不正です" };
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  // 23505 (DEFERRABLE UNIQUE 衝突) は並列 RPC で発生し得るので数回 retry
  // (reorderTodo / tryInsertWithPosition と同じパターン)。
  const MAX_RETRIES = 4;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { error } = await auth.supabase.rpc("move_todo", {
      todo_id: id,
      new_bucket: targetBucket,
      new_position: targetPosition,
    });
    if (!error) {
      revalidatePath("/");
      return { ok: true };
    }
    lastErr = error;
    const code = (error as { code?: string }).code;
    if (code !== "23505") break;
  }
  console.error("moveTodo rpc failed", safeErrorContext(lastErr));
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

  // 冪等性: DB の部分 UNIQUE index (todos_unique_carry_idem_idx, 0011) が
  // (user_id, target_date, carry_from_todo_id) で重複 INSERT を物理ブロックする。
  // 並列 2 タブで同じ src.id を carry しようとしても DB が片方を 23505 で reject し、
  // tryInsertWithPosition が carryDuplicate=true として冪等成功を返す。
  //
  // 冪等性の事前チェック (Round 5/6 Copilot review): 既に同じ src.id を元にした
  // carry が tomorrow に存在する場合、本処理は no-op になるので件数上限の
  // 制約を受けず冪等 ok を返す。これをやらないと、上限到達済みのユーザーが
  // 「同じ ToDo を carry」しようとしただけで limit エラーになり冪等性が壊れる。
  //
  // ToDo 単位 (date 単位ではない) で冪等チェックすることで、昨日の未完了が
  // 複数件あっても全件 carry できる (Round 6 review)。
  const { data: existingCarry, error: dupErr } = await auth.supabase
    .from("todos")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("target_date", tomorrow)
    .eq("carry_from_todo_id", src.id)
    .limit(1)
    .maybeSingle();

  if (dupErr) {
    console.error("carryTodoToTomorrow dup check failed", safeErrorContext(dupErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (existingCarry) {
    // 既に carry 済 → 冪等 ok (限度件数チェックをスキップ)
    revalidatePath("/");
    return { ok: true };
  }

  // 新規 carry の場合のみ件数上限の事前チェック
  const { count: cnt, error: cntErr } = await countTodos(
    auth.supabase,
    auth.user.id,
    tomorrow,
  );
  if (cntErr) {
    console.error("carryTodoToTomorrow count failed", safeErrorContext(cntErr));
    return { ok: false, error: GENERIC_ERROR };
  }
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
      carry_from_todo_id: src.id,
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
      "id, target_date, text, bucket, time, position, done, important, carry_from_date, carry_from_todo_id, created_at, updated_at",
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
      "id, target_date, text, bucket, time, position, done, important, carry_from_date, carry_from_todo_id, created_at, updated_at",
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

  // 取得: RLS + user_id で他人の id は弾かれる。position も取得して
  // 「昨日の並び」を保ったまま今日に挿入できるようにする (Copilot review)。
  const { data: sources, error: fetchErr } = await auth.supabase
    .from("todos")
    .select("id, target_date, text, bucket, time, important, position")
    .in("id", uniqueIds)
    .eq("user_id", auth.user.id)
    .order("target_date", { ascending: true })
    .order("bucket", { ascending: true })
    .order("position", { ascending: true });

  if (fetchErr) {
    console.error("acceptCarryProposal fetch failed", safeErrorContext(fetchErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!sources || sources.length === 0) {
    return { ok: false, error: "対象の ToDo が見つかりません" };
  }

  // 冪等性は DB の部分 UNIQUE index (todos_unique_carry_idem_idx, 0011) が担保。
  // 並列 2 タブ accept で両方が同じ source ToDo を insert しようとしても、
  // 後者は 23505 (todos_unique_carry_idem_idx) で reject される → carryDuplicate
  // で冪等成功とみなして skip。
  //
  // 件数上限の事前チェック (Round 5/6 Copilot review):
  // 単純に `cnt + sources.length` で見ると、全部 carry 済 (= 全件 carryDuplicate
  // で実際は INSERT 0 件) のケースでも上限近辺で error になり冪等性が壊れる。
  // 既に carry 済の source_todo_id を除いた「新規 INSERT 期待数」で比較する。
  //
  // Round 6 fix: UNIQUE が ToDo 単位 (carry_from_todo_id) に変わったので、
  // expectedNew は「todayDate に carry_from_todo_id として未登録の uniqueIds の数」。
  // これにより同じ日からの複数 ToDo carry も正しく見積もれる。
  const { data: existingCarries, error: dupErr } = await auth.supabase
    .from("todos")
    .select("carry_from_todo_id")
    .eq("user_id", auth.user.id)
    .eq("target_date", todayDate)
    .in("carry_from_todo_id", uniqueIds);

  if (dupErr) {
    console.error("acceptCarryProposal dup check failed", safeErrorContext(dupErr));
    return { ok: false, error: GENERIC_ERROR };
  }

  const existingIds = new Set(
    (existingCarries ?? [])
      .map((c) => c.carry_from_todo_id as string | null)
      .filter((id): id is string => !!id),
  );
  const expectedNew = uniqueIds.filter((id) => !existingIds.has(id)).length;

  const { count: cnt, error: cntErr } = await countTodos(
    auth.supabase,
    auth.user.id,
    todayDate,
  );
  if (cntErr) {
    console.error("acceptCarryProposal count failed", safeErrorContext(cntErr));
    return { ok: false, error: GENERIC_ERROR };
  }
  if (cnt + expectedNew > MAX_TODOS_PER_DAY) {
    return {
      ok: false,
      error: `1 日 ${MAX_TODOS_PER_DAY} 件を超えるため取り込めません`,
    };
  }

  // Round 12 Copilot review (perf): 旧実装は sources 件数分ループして毎回
  // tryInsertWithPosition (= max position 取得 + insert) を走らせていたので、
  // MAX_CARRY_BATCH=50 件で 100 往復になっていた。bucket ごとに max を 1 度だけ
  // 取り、ローカルで position をインクリメントしてから batch INSERT する。
  // 並列衝突 (23505) の rare ケースだけ既存の tryInsertWithPosition に fallback。

  // 既存 carry 済の source は事前フィルタリングで除外 (= 二重 INSERT させない)
  const newSources = sources.filter((s) => !existingIds.has(s.id));
  if (newSources.length === 0) {
    // 全部 carry 済 → 冪等成功
    revalidatePath("/");
    return { ok: true };
  }

  // bucket でグルーピング (sources は target_date asc / bucket asc / position asc
  // で取得済みなので、各 bucket 内の順序は維持される)
  const byBucket = new Map<TodoBucket, typeof newSources>();
  for (const s of newSources) {
    const bucket = s.bucket as TodoBucket;
    const arr = byBucket.get(bucket);
    if (arr) arr.push(s);
    else byBucket.set(bucket, [s]);
  }

  // bucket ごとに max position を 1 度だけ取得し、insert 行を組み立てる
  type InsertRow = {
    user_id: string;
    target_date: string;
    bucket: TodoBucket;
    position: number;
    text: string;
    time: string | null;
    important: boolean;
    carry_from_date: string;
    carry_from_todo_id: string;
  };
  const insertRows: InsertRow[] = [];
  for (const [bucket, items] of byBucket) {
    const { data: maxRow, error: maxErr } = await auth.supabase
      .from("todos")
      .select("position")
      .eq("user_id", auth.user.id)
      .eq("target_date", todayDate)
      .eq("bucket", bucket)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      console.error("acceptCarryProposal max-pos failed", safeErrorContext(maxErr));
      return { ok: false, error: GENERIC_ERROR };
    }
    let nextPos = (maxRow?.position ?? -1) + 1;
    for (const s of items) {
      insertRows.push({
        user_id: auth.user.id,
        target_date: todayDate,
        bucket,
        position: nextPos++,
        text: s.text,
        time: s.time,
        important: s.important,
        carry_from_date: s.target_date,
        carry_from_todo_id: s.id,
      });
    }
  }

  // batch INSERT (= 1 round-trip で全件)
  const { error: batchErr } = await auth.supabase.from("todos").insert(insertRows);
  if (!batchErr) {
    revalidatePath("/");
    return { ok: true };
  }

  // 23505 は並列タブによる position / carry idem 衝突。1 件単位で
  // tryInsertWithPosition に fallback (carry duplicate は冪等成功扱い、
  // position 衝突は max+1 を取り直して retry)。それ以外は即 error 返却。
  const code = (batchErr as { code?: string }).code;
  if (code !== "23505") {
    console.error("acceptCarryProposal batch insert failed", safeErrorContext(batchErr));
    return { ok: false, error: GENERIC_ERROR };
  }

  for (const s of newSources) {
    const { error: rowErr } = await tryInsertWithPosition(
      auth.supabase,
      auth.user.id,
      todayDate,
      s.bucket as TodoBucket,
      {
        text: s.text,
        time: s.time,
        important: s.important,
        carry_from_date: s.target_date,
        carry_from_todo_id: s.id,
      },
    );
    if (rowErr) {
      console.error(
        "acceptCarryProposal fallback insert failed",
        safeErrorContext(rowErr),
      );
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  revalidatePath("/");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Public helper
// --------------------------------------------------------------------------

export async function getTodayJstDate(): Promise<string> {
  return toJstDateString(new Date());
}
