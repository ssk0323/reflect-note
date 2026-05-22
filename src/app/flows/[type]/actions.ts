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
