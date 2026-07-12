"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/wallet-txns", label: "未処理明細" },
  { href: "/wallet-txns/rules", label: "自動登録ルール" },
] as const;

export function WalletTxnSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="未処理明細メニュー"
      className="mt-4 flex flex-wrap gap-2"
    >
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/wallet-txns" && pathname.startsWith(link.href));
        return (
          <NextLink
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[var(--freee-blue)]/10 text-[var(--freee-blue)]"
                : "border border-[var(--freee-border)] text-[var(--freee-text-muted)] hover:text-[var(--freee-text)]"
            }`}
          >
            {link.label}
          </NextLink>
        );
      })}
    </nav>
  );
}
