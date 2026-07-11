import Link from "next/link";

const navigation = [
  { href: "/wallet-txns", label: "未処理明細" },
  { href: "/recurring-invoices", label: "定型請求" },
  { href: "/invoices", label: "請求書" },
] as const;

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="font-mono text-sm font-black tracking-[0.18em] text-slate-950 uppercase dark:text-white"
        >
          freee ops desk
        </Link>
        <nav aria-label="主要メニュー" className="flex items-center gap-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-lime-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-600 dark:text-slate-300 dark:hover:bg-lime-950 dark:hover:text-lime-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <a
          href="/api/auth/login"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-lime-500 hover:bg-lime-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-lime-950"
        >
          事業所切替
        </a>
      </div>
    </header>
  );
}
