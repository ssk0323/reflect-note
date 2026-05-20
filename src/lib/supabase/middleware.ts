import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// supabase.auth.signOut() などで設定された cookie を保持したまま
// redirect レスポンスを返すためのヘルパー。
function redirectWithCookies(source: NextResponse, location: URL): NextResponse {
  const redirect = NextResponse.redirect(location);
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (user) {
    // fail-closed: ALLOWED_EMAILS が未設定 / 空のときは全員拒否する。
    // 設定漏れで誰でもログインできる事故を防ぐため、明示設定を要求する。
    const allowed = getAllowedEmails();
    const email = user.email?.toLowerCase();
    if (allowed.length === 0 || !email || !allowed.includes(email)) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set(
        "error",
        allowed.length === 0 ? "allowlist_not_configured" : "forbidden_email",
      );
      return redirectWithCookies(response, loginUrl);
    }
  }

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("redirectTo", `${pathname}${search}`);
    return redirectWithCookies(response, loginUrl);
  }

  return response;
}
