"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteRecord(id: string): Promise<DeleteResult> {
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

  // RLS で user_id = auth.uid() のレコードしか delete できない。
  // 0 行削除でも error が null のまま戻ってくるため、.select("id") で
  // 削除対象の存在を明示的に確認する。
  const { data, error } = await supabase
    .from("records")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: "削除対象の記録が見つかりません" };
  }

  revalidatePath("/history");
  return { ok: true };
}
