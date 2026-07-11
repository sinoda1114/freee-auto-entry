import type { Metadata } from "next";
import { BIZ_UDGothic, JetBrains_Mono } from "next/font/google";
import { AppHeader } from "./AppHeader";
import "./globals.css";

const bizUdGothic = BIZ_UDGothic({
  variable: "--font-biz-ud-gothic",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "freee経理・請求管理",
  description: "freeeの未処理明細と定型請求をまとめて管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${bizUdGothic.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only z-50 rounded bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          本文へスキップ
        </a>
        <AppHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
