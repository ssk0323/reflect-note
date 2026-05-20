import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignInWithGoogleButton } from "./SignInWithGoogleButton";

type SearchParams = Promise<{ redirectTo?: string; error?: string }>;

const ERROR_MESSAGES: Record<string, string> = {
  forbidden_email: "このメールアドレスはログインを許可されていません。",
  missing_code: "認証コードが取得できませんでした。もう一度お試しください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { redirectTo, error } = await searchParams;
  const safeRedirectTo =
    redirectTo && redirectTo.startsWith("/") ? redirectTo : "/";

  // Next.js は searchParams を既にデコード済みで渡してくれるが、
  // 不正な % シーケンスを含む手動アクセスに備えて防御的にしておく。
  let errorMessage: string | null = null;
  if (error) {
    errorMessage = ERROR_MESSAGES[error] ?? error;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          reflect-note にサインイン
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Google アカウントでログインしてください。許可されていないアカウントは弾かれます。
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:bg-red-950 dark:text-red-200"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-8">
          <SignInWithGoogleButton redirectTo={safeRedirectTo} />
        </div>
      </div>
    </main>
  );
}
