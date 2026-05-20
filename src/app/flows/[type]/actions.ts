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

  // RLS で user_id = auth.uid() のレコードしか update できないので
  // 他人の id を渡しても安全に弾かれる。
  // ただし RLS で 0 行マッチや存在しない id の場合は error が null のまま
  // 戻ってくるため、.select("id") で更新対象の存在を明示的に確認する。
  const { data, error } = await supabase
    .from("records")
    .update({ answers })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: "更新対象の記録が見つかりません" };
  }

  revalidatePath("/history");
  return { ok: true };
}
