import type { Metadata } from "next";
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
