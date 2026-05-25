import Link from "next/link";

type Props = {
  message: string;
  /** "12/20 23:14" や "2025/12/31 22:00" など、年またぎで誤解しない表記 */
  meta: string;
  /** タップ先 — 履歴の該当日 or 編集画面 */
  href: string;
};

/** 前日の夜に書いた「明日の自分へひとこと」を画面最上部に静かに置くバナー。
 *  team review P1: 「タップで全文」ラベルと実遷移先 (編集画面) が乖離していたので、
 *  ラベルを「振り返りを開く」相当の意味に揃え、href も履歴系を優先して受け取る。 */
export function YesterdayMessage({ message, meta, href }: Props) {
  const trimmed = message.trim();
  if (!trimmed) {
    return <YesterdayMessageEmpty />;
  }

  return (
    <Link
      href={href}
      aria-label={`昨日のあなたからのメッセージ ${meta}。前日の夜の振り返りを開く`}
      className="block"
      style={{
        marginBottom: 16,
        padding: "10px 18px",
        background: "var(--color-bg-2)",
        border: "1.2px dashed var(--color-line)",
        borderRadius: "18px 22px 16px 20px / 18px 16px 22px 18px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span
          className="sk-eyebrow"
          style={{ flexShrink: 0, color: "var(--color-ink-2)" }}
        >
          昨日のあなたから · {meta}
        </span>
        <span
          className="sk-mono"
          style={{ color: "var(--color-ink-2)", flexShrink: 0 }}
        >
          開く ›
        </span>
      </div>
      <p
        className="mt-1"
        style={{
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 16,
          fontStyle: "italic",
          color: "var(--color-ink)",
          lineHeight: 1.35,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          margin: 0,
        }}
      >
        〝{trimmed}〟
      </p>
    </Link>
  );
}

function YesterdayMessageEmpty() {
  return (
    <div
      className="sk-card sk-card-dashed"
      style={{
        marginBottom: 16,
        padding: "10px 16px",
        textAlign: "center",
      }}
    >
      <span className="sk-mono" style={{ color: "var(--color-ink-3)" }}>
        昨日の夜に書いた「明日の自分へひとこと」がここに表示されます
      </span>
    </div>
  );
}
