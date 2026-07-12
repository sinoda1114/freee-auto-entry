import type { Metadata } from "next";
import { Suspense } from "react";
import { BIZ_UDGothic, JetBrains_Mono } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-brand";
import { AppHeader } from "./AppHeader";
import { HeaderFallback } from "./components/HeaderFallback";
import { Providers } from "./providers";
import "./globals.css";

const bizUdGothic = BIZ_UDGothic({
  variable: "--font-biz-ud-gothic",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${bizUdGothic.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[var(--freee-bg)] text-[var(--freee-text)]">
        <Providers>
          <a
            href="#main-content"
            className="sr-only z-50 rounded bg-[var(--freee-surface)] px-4 py-2 text-[var(--freee-text)] focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            本文へスキップ
          </a>
          <Suspense fallback={<HeaderFallback />}>
            <AppHeader />
          </Suspense>
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
