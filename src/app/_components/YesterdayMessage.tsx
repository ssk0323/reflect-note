import Link from "next/link";

type Props = {
  /** 前日 (or 直近) の night record から取った messageToTomorrowSelf。空なら未入力。 */
  message: string;
  /** 表示用の日付ラベル (例: "5/20 23:14") */
  meta: string;
  /** 「全文」リンク先 (例: /history?year=... の該当日) */
  href: string;
};

/** 前日の夜に書いた「明日の自分へひとこと」を画面最上部に静かに置くバナー。
 *  1 行目: メタ + 全文リンク / 2 行目: メッセージ (溢れたら ... で省略)。 */
export function YesterdayMessage({ message, meta, href }: Props) {
  const trimmed = message.trim();
  if (!trimmed) {
    return <YesterdayMessageEmpty />;
  }

  return (
    <Link
      href={href}
      aria-label={`昨日のあなたから ${meta}。全文を見る`}
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
      <div className="flex items-baseline justify-between gap-2">
        <span className="sk-eyebrow" style={{ flexShrink: 0 }}>
          昨日のあなたから · {meta}
        </span>
        <span
          className="sk-mono"
          style={{ color: "var(--color-ink-4)", flexShrink: 0 }}
        >
          タップで全文 ›
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
      <span className="sk-mono" style={{ color: "var(--color-ink-4)" }}>
        昨日の夜に書いた「明日の自分へひとこと」がここに表示されます
      </span>
    </div>
  );
}
