"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FLOW_TYPES, type FlowAnswers, type FlowType } from "@/lib/flows";
import {
  isAllowedDirection,
  isValidDateString,
  normalizeTargetDate,
} from "@/lib/records/targetDate";

export type SaveResult = { ok: true } | { ok: false; error: string };

export type FindExistingResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

/** Issue #46 新方針: 朝のセットアップ等で「日付を選んだら既存 record があるか
 *  チェックして edit モードへ自動切替」するための server action。
 *  RLS で他人の record は弾かれる。同 (user, type, target_date) で複数 record
 *  ある場合は最新 (created_at desc) の id を返す。 */
export async function findExistingRecord(
  type: FlowType,
  targetDate: string,
): Promise<FindExistingResult> {
  if (!FLOW_TYPES.includes(type)) {
    return { ok: false, error: `不正なフロー種別: ${type}` };
  }
  if (!isValidDateString(targetDate)) {
    return { ok: false, error: "日付が不正です" };
  }
  const normalized = normalizeTargetDate(type, targetDate);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { data, error } = await supabase
    .from("records")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", type)
    .eq("target_date", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("findExistingRecord failed", error);
    return { ok: false, error: "既存記録の確認に失敗しました" };
  }
  return { ok: true, id: data?.id ?? null };
}

/** 朝のセットアップで入力された task1/2/3 を todos テーブルに自動連携する。
 *  Issue #38 拡張 (B): 朝の宣言が ToDo 画面に出てこないと「実行する場」と
 *  「宣言する場」が分断されてしまうので、朝の record INSERT 成功時に morning
 *  バケットへ流す。空文字は skip。500 文字を超える text は CHECK 制約に違反するので
 *  事前に slice する。
 *
 *  失敗時は親 record 保存を巻き戻さず log のみ (record が primary、todos は派生)。
 *  position は INSERT 毎に max+1 を取り直して UNIQUE 違反を回避する。 */
async function syncMorningTasksToTodos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  targetDate: string,
  answers: FlowAnswers,
): Promise<void> {
  const candidates = (["task1", "task2", "task3"] as const)
    .map((k) => answers[k])
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().slice(0, 500));

  // Round 11 Copilot review: records 側に (user, type, target_date) UNIQUE が
  // 無いため同じ日に morning を複数回保存できる。連携を冪等にするため、
  // 同じ (user, target_date, bucket=morning, text) の todo が既にあれば skip する。
  // 厳密な link テーブルではなく text 同値で重複検知する heuristic だが、
  // 「同じ task1 を 2 回書く」「タスク文を編集後に再連携」程度は捌ける。
  const { data: existingRows, error: existingErr } = await supabase
    .from("todos")
    .select("text")
    .eq("user_id", userId)
    .eq("target_date", targetDate)
    .eq("bucket", "morning");
  if (existingErr) {
    const code = (existingErr as { code?: string }).code;
    console.error("syncMorningTasksToTodos pre-check failed", { code });
    return;
  }
  const existingTexts = new Set((existingRows ?? []).map((r) => r.text as string));

  for (const text of candidates) {
    if (existingTexts.has(text)) continue;
    // 次の iteration でも同じ text の重複 INSERT を抑止する
    existingTexts.add(text);
    // Round 10 review: error を捨てると nextPos=0 で UNIQUE 違反になり原因が
    // 分かりづらくなる。明示的に拾って break する。
    const { data: maxRow, error: maxErr } = await supabase
      .from("todos")
      .select("position")
      .eq("user_id", userId)
      .eq("target_date", targetDate)
      .eq("bucket", "morning")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      const code = (maxErr as { code?: string }).code;
      console.error("syncMorningTasksToTodos max-pos query failed", { code });
      break;
    }
    const nextPos = (maxRow?.position ?? -1) + 1;

    // Round 10 review: task1/2/3 は UI 上「★大事な 3 つ」として扱われている
    // (Home の凡例 / GoalsStrip の STAR_KEYS) ので important=true で揃える。
    const { error } = await supabase.from("todos").insert({
      user_id: userId,
      target_date: targetDate,
      bucket: "morning",
      position: nextPos,
      text,
      time: null,
      important: true,
      carry_from_date: null,
      carry_from_todo_id: null,
    });
    if (error) {
      const code = (error as { code?: string }).code;
      console.error("syncMorningTasksToTodos failed", { code });
      // record 保存自体は成功しているので、ここでは throw しない (best-effort)。
      // 連続失敗を抑えるため break する (例: 上限到達 / 列欠落など)。
      break;
    }
  }
}

/** target_date を検証して正規化。不正なら null を返す (= 呼び出し側で error にする)。
 *  `now` は direction 判定の基準時刻。編集時はそのレコードの created_at を渡すと、
 *  「過去に書いた future フローを後日編集すると保存できない」問題を防げる。 */
function validateAndNormalizeTargetDate(
  type: FlowType,
  raw: string,
  now: Date = new Date(),
): string | null {
  if (!isValidDateString(raw)) return null;
  const normalized = normalizeTargetDate(type, raw);
  if (!isAllowedDirection(type, normalized, now)) return null;
  return normalized;
}

export async function saveFlowRecord(
  type: FlowType,
  answers: FlowAnswers,
  targetDate: string,
): Promise<SaveResult> {
  if (!FLOW_TYPES.includes(type)) {
    return { ok: false, error: `不正なフロー種別: ${type}` };
  }

  const normalized = validateAndNormalizeTargetDate(type, targetDate);
  if (!normalized) {
    return { ok: false, error: "選択できない日付です" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  const { error } = await supabase.from("records").insert({
    type,
    answers,
    target_date: normalized,
    user_id: user.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // 朝のセットアップ確定時に task1/2/3 を todos に自動連携 (Issue #38 拡張)
  if (type === "morning") {
    await syncMorningTasksToTodos(supabase, user.id, normalized, answers);
  }

  // トップの「本日の目標」「今週/今月の目標」は新規 record で即更新したい
  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true };
}

export async function updateFlowRecord(
  id: string,
  answers: FlowAnswers,
  targetDate: string,
): Promise<SaveResult> {
  if (!id) {
    return { ok: false, error: "id が指定されていません" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  // 既存の answers / checks / type / created_at を取得。
  // - type は target_date 正規化と方向判定に必要
  // - created_at は direction 判定の基準時刻として使う
  //   (今日「1 週間前の morning」を編集するとき、now=今日 だと future check が
  //    過去日扱いで失敗するため、レコード作成時点を基準にする)
  const { data: existing, error: fetchError } = await supabase
    .from("records")
    .select("type, answers, checks, created_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to read existing record for update", fetchError);
    return { ok: false, error: "更新前の記録を取得できませんでした" };
  }
  if (!existing) {
    return { ok: false, error: "更新対象の記録が見つかりません" };
  }

  const type = existing.type as FlowType;
  const createdAt = new Date(existing.created_at);
  const normalizedTargetDate = validateAndNormalizeTargetDate(
    type,
    targetDate,
    createdAt,
  );
  if (!normalizedTargetDate) {
    return { ok: false, error: "選択できない日付です" };
  }

  const oldAnswers = (existing.answers ?? {}) as FlowAnswers;
  const oldChecks = (existing.checks ?? {}) as Record<string, boolean>;
  const nextChecks: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(oldChecks)) {
    if (oldAnswers[key] === answers[key]) {
      nextChecks[key] = value;
    }
  }

  // RLS で user_id = auth.uid() のレコードしか update できない。
  // 0 行マッチ (RLS / stale id) は .select("id") で検知して error にする。
  const { data, error } = await supabase
    .from("records")
    .update({
      answers,
      checks: nextChecks,
      target_date: normalizedTargetDate,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: "更新対象の記録が見つかりません" };
  }

  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true };
}
