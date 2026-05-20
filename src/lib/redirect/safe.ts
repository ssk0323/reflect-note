/**
 * リダイレクト先 URL が同一オリジン内のパスのみに限定されているかを判定する。
 *
 * `value.startsWith("/")` だけだと "//evil.com/..." のプロトコル相対 URL や
 * "/\\evil.com" のような攻撃も通り、ブラウザは外部にリダイレクトしてしまう。
 * よって以下をすべて満たすときだけ "安全" とみなす:
 *   - 文字列であること
 *   - "/" から始まる
 *   - "//" から始まらない (プロトコル相対)
 *   - "/\" から始まらない (Windows パス的な誤解釈防止)
 */
export function isSafeInternalPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  );
}

/** 安全なら value を、不正なら fallback を返す。 */
export function pickSafeInternalPath(
  value: unknown,
  fallback = "/",
): string {
  return isSafeInternalPath(value) ? value : fallback;
}
