import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Next.js が描画する全パスをマッチ。ただし以下は除外:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     * - manifest.webmanifest (PWA: 未認証でもインストーラーが取得する必要がある)
     * - 静的アセット (svg/png/jpg/jpeg/gif/webp)
     *
     * 拡張子のドットは `\\.` でエスケープしリテラルに扱う (Copilot review PR #37)。
     * エスケープ無しだと `.` がワイルドカードになり、例えば `favicon/ico` や
     * `manifestXwebmanifest` のような意図しないパスも除外対象になる。
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
