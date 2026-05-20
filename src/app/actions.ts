"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ToggleResult =
  | { ok: true; checked: boolean }
  | { ok: false; error: string };

/**
 * records.checks[key] を atomic に反転する。
 *
 * 内部では `toggle_record_check` RPC (jsonb_set + 1 query) を呼ぶ。
 * read-modify-write の race condition を回避するため、
 * クライアント側で merge してから update する実装はやめている。
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

  const { data, error } = await supabase.rpc("toggle_record_check", {
    p_record_id: recordId,
    p_key: key,
  });

  if (error) {
    console.error("toggle_record_check failed", error);
    return { ok: false, error: "チェックの更新に失敗しました" };
  }

  // RPC が boolean を返す。RLS で対象行が無い場合は null が返る (update が 0 行)。
  if (data === null || data === undefined) {
    return { ok: false, error: "対象の記録が見つかりません" };
  }

  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true, checked: Boolean(data) };
}
