"use client";

import { NavbarItem } from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

export type NavDomain = "accounting" | "billing";

export type NavItem = {
  href: string;
  label: string;
  domain: NavDomain;
};

const accountingNav: NavItem[] = [
  { href: "/monthly-close", label: "月次", domain: "accounting" },
  { href: "/wallet-txns", label: "未処理明細", domain: "accounting" },
];

const billingNav: NavItem[] = [
  { href: "/recurring-invoices", label: "定型請求", domain: "billing" },
  { href: "/invoices", label: "請求書", domain: "billing" },
];

export function getNavigationItems(canRegisterExpense: boolean): NavItem[] {
  const accounting = canRegisterExpense
    ? [
        ...accountingNav,
        { href: "/expenses/new", label: "経費", domain: "accounting" as const },
      ]
    : accountingNav;
  return [...accounting, ...billingNav];
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean, domain: NavDomain): string {
  if (active) {
    return domain === "accounting"
      ? "bg-[var(--freee-blue)]/10 text-[var(--freee-blue)]"
      : "bg-[var(--freee-billing)]/10 text-[var(--freee-billing)]";
  }
  return "text-[var(--freee-text-muted)] hover:bg-[var(--freee-bg)] hover:text-[var(--freee-text)]";
}

export function HeaderNav({
  canRegisterExpense = false,
}: {
  canRegisterExpense?: boolean;
}) {
  const pathname = usePathname();
  const navigation = getNavigationItems(canRegisterExpense);
  const accountingItems = navigation.filter((i) => i.domain === "accounting");
  const billingItems = navigation.filter((i) => i.domain === "billing");

  return (
    <>
      {accountingItems.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <NavbarItem key={item.href} isActive={active}>
            <NextLink
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${navLinkClass(active, item.domain)}`}
            >
              {item.label}
            </NextLink>
          </NavbarItem>
        );
      })}
      <NavbarItem aria-hidden className="px-1">
        <span className="inline-block h-4 w-px bg-[var(--freee-border)]" />
      </NavbarItem>
      {billingItems.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <NavbarItem key={item.href} isActive={active}>
            <NextLink
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${navLinkClass(active, item.domain)}`}
            >
              {item.label}
            </NextLink>
          </NavbarItem>
        );
      })}
    </>
  );
}
