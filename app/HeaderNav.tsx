"use client";

import { NavbarItem } from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/wallet-txns", label: "未処理明細" },
  { href: "/recurring-invoices", label: "定型請求" },
  { href: "/invoices", label: "請求書" },
] as const;

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <>
      {navigation.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <NavbarItem key={item.href} isActive={active}>
            <NextLink
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--freee-blue)]/10 text-[var(--freee-blue)]"
                  : "text-[var(--freee-text-muted)] hover:bg-[var(--freee-bg)] hover:text-[var(--freee-text)]"
              }`}
            >
              {item.label}
            </NextLink>
          </NavbarItem>
        );
      })}
    </>
  );
}
