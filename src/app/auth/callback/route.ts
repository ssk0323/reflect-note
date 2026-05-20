import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickSafeInternalPath } from "@/lib/redirect/safe";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Supabase の生エラーメッセージを表に出さない (情報漏洩防止)。
    // 詳細はサーバーログにのみ残す。
    console.error("exchangeCodeForSession failed", error);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // "//evil.com/path" 等のプロトコル相対 URL を弾く
  const safeNext = pickSafeInternalPath(next);
  return NextResponse.redirect(`${origin}${safeNext}`);
}
