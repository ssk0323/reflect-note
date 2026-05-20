// Next.js のバンドラは process.env.NEXT_PUBLIC_X のように
// プロパティ名をリテラルで書いた場合のみ静的置換できる。
// process.env[name] のような動的アクセスだとクライアントバンドルに値が含まれず
// 「Missing environment variable」になるので、必ずリテラルでアクセスすること。

export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and fill it in.",
    );
  }
  return value;
}

export function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in.",
    );
  }
  return value;
}
