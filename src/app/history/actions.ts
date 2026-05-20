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
  const { error } = await supabase.from("records").delete().eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/history");
  return { ok: true };
}
