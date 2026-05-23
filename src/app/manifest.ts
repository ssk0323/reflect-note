import type { MetadataRoute } from "next";

/** PWA manifest. Android で「ホーム画面に追加」した時、ここの icons[] が
 *  使われる。iOS は apple-icon.png (Next.js convention) を別途参照する。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "reflect-note",
    short_name: "reflect",
    description:
      "朝に整え、夜に振り返る。リフレクションを習慣化するためのアプリ。",
    start_url: "/",
    display: "standalone",
    // Hero と同じ暖かいオフホワイト (oklch 98% 0.008 80 ≈ #f8f5ed)
    background_color: "#f8f5ed",
    // ステータスバー色 = 墨色 (oklch 22% 0.015 60 ≈ #3a3530)
    theme_color: "#3a3530",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
