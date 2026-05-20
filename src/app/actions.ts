"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ToggleResult =
  | { ok: true; checked: boolean }
  | { ok: false; error: string };

// records.checks のキーは answers の question key と同じ形式に限定する。
// 想定外の長い文字列や記号を弾き、JSONB が肥大化したり意図しないキーが
// 混入するのを防ぐ (英数字 + アンダースコア、最大 64 文字)。
const VALID_KEY_REGEX = /^[A-Za-z0-9_]{1,64}$/;
// UUID v4 など (Supabase の gen_random_uuid 形式)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!recordId || !UUID_REGEX.test(recordId)) {
    return { ok: false, error: "recordId が不正です" };
  }
  if (!key || !VALID_KEY_REGEX.test(key)) {
    return { ok: false, error: "key が不正です" };
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
