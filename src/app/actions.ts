"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ToggleResult = { ok: true; checked: boolean } | { ok: false; error: string };

/**
 * records.checks[key] のチェック状態をトグルする。
 *
 * 既存の checks を読み込んで反転させ、その上で update を投げる。
 * 同一レコードを並行更新するケースは想定していない (個人利用前提)。
 */
export async function toggleCheck(
  recordId: string,
  key: string,
): Promise<ToggleResult> {
  if (!recordId) {
    return { ok: false, error: "recordId が指定されていません" };
  }
  if (!key) {
    return { ok: false, error: "key が指定されていません" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  // 現在の checks を読み取り (RLS で他人のレコードは取れない)
  const { data: existing, error: fetchError } = await supabase
    .from("records")
    .select("checks")
    .eq("id", recordId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to read checks", fetchError);
    return { ok: false, error: "現在のチェック状態を取得できませんでした" };
  }
  if (!existing) {
    return { ok: false, error: "対象の記録が見つかりません" };
  }

  const current = (existing.checks ?? {}) as Record<string, boolean>;
  const nextValue = !current[key];
  const nextChecks = { ...current, [key]: nextValue };

  const { data: updated, error: updateError } = await supabase
    .from("records")
    .update({ checks: nextChecks })
    .eq("id", recordId)
    .select("id");

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "更新対象の記録が見つかりません" };
  }

  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true, checked: nextValue };
}
