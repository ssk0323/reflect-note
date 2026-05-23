import type { Metadata, Viewport } from "next";
import { Kalam, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const kalam = Kalam({
  variable: "--font-sans",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "reflect-note",
  description: "朝に整え、夜に振り返る。リフレクションを習慣化するためのアプリ。",
  // iOS Safari の「ホームに追加」で web app として開けるようにする。
  appleWebApp: {
    capable: true,
    title: "reflect-note",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Android Chrome のステータスバーや iOS Safari のタブ色に反映される。
  // 墨色 (oklch 22% 0.015 60 ≈ #3a3530) で manifest と揃える。
  themeColor: "#3a3530",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${kalam.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
