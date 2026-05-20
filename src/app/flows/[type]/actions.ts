"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FLOW_TYPES, type FlowAnswers, type FlowType } from "@/lib/flows";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveFlowRecord(
  type: FlowType,
  answers: FlowAnswers,
): Promise<SaveResult> {
  if (!FLOW_TYPES.includes(type)) {
    return { ok: false, error: `不正なフロー種別: ${type}` };
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

  // 既存の answers と checks を取得し、値が変わったキーに対応する
  // checks を破棄する。
  // 例: task1 を "A" → "B" に編集したら、checks.task1 は false に戻す。
  // RLS で他人のレコードは取れないので、ここで found = 自分のもの。
  const { data: existing, error: fetchError } = await supabase
    .from("records")
    .select("answers, checks")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to read existing record for update", fetchError);
    return { ok: false, error: "更新前の記録を取得できませんでした" };
  }
  if (!existing) {
    return { ok: false, error: "更新対象の記録が見つかりません" };
  }

  const oldAnswers = (existing.answers ?? {}) as FlowAnswers;
  const oldChecks = (existing.checks ?? {}) as Record<string, boolean>;
  const nextChecks: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(oldChecks)) {
    // 値が変わっていなければチェック状態を維持
    if (oldAnswers[key] === answers[key]) {
      nextChecks[key] = value;
    }
  }

  // RLS で user_id = auth.uid() のレコードしか update できない。
  // 0 行マッチ (RLS / stale id) は .select("id") で検知して error にする。
  const { data, error } = await supabase
    .from("records")
    .update({ answers, checks: nextChecks })
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
