"use server";

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

  return { ok: true };
}
