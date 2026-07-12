"use client";

import { useState } from "react";
import {
  Button,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./components/ThemeToggle";
import type { CompanyOption } from "./CompanySwitcher";
import { CompanySwitcher } from "./CompanySwitcher";
import { APP_NAME } from "@/lib/app-brand";
import {
  getNavigationItems,
  HeaderNav,
  isNavItemActive,
} from "./HeaderNav";

interface AppNavbarProps {
  authenticated: boolean;
  companies: CompanyOption[];
  activeCompanyId?: string;
  canRegisterExpense?: boolean;
}

export function AppNavbar({
  authenticated,
  companies,
  activeCompanyId,
  canRegisterExpense = false,
}: AppNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const mobileItems = getNavigationItems(canRegisterExpense);

  return (
    <Navbar
      maxWidth="xl"
      isBordered
      height="3rem"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      classNames={{
        base: "min-h-12 border-b border-[var(--freee-border)] bg-[var(--freee-surface)]",
        wrapper: "h-12 gap-2 px-4 sm:px-5",
        item: "data-[active=true]:bg-transparent",
      }}
    >
      {authenticated ? (
        <NavbarContent className="md:hidden" justify="start">
          <NavbarMenuToggle
            aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
          />
        </NavbarContent>
      ) : null}

      <NavbarBrand className="flex-shrink-0">
        <NextLink
          href="/"
          className="text-sm font-bold tracking-tight text-[var(--freee-text)]"
          aria-label={APP_NAME}
        >
          <span>スマート経理</span>
          <span className="ml-1 font-normal text-[var(--freee-text-muted)]">
            for{" "}
          </span>
          <span className="text-[var(--freee-blue)]">freee</span>
        </NextLink>
      </NavbarBrand>

      {authenticated ? (
        <NavbarContent className="hidden gap-0.5 md:flex" justify="center">
          <HeaderNav canRegisterExpense={canRegisterExpense} />
        </NavbarContent>
      ) : null}

      <NavbarContent
        justify="end"
        className="ml-auto flex-shrink-0 gap-1.5 sm:gap-2"
      >
        {authenticated && canRegisterExpense ? (
          <NavbarItem className="flex items-center">
            <Button
              as={NextLink}
              href="/expenses/new"
              color="primary"
              size="sm"
              className="min-w-0 px-2.5"
              aria-label="経費を登録"
            >
              経費
            </Button>
          </NavbarItem>
        ) : null}
        <NavbarItem className="flex items-center">
          <ThemeToggle />
        </NavbarItem>
        {authenticated && companies.length > 0 ? (
          <NavbarItem className="flex items-center">
            <CompanySwitcher
              companies={companies}
              activeCompanyId={activeCompanyId}
            />
          </NavbarItem>
        ) : null}
        {authenticated ? null : (
          <NavbarItem className="flex items-center">
            <Button
              as={NextLink}
              href="/api/auth/login"
              color="primary"
              size="sm"
            >
              freeeと連携
            </Button>
          </NavbarItem>
        )}
      </NavbarContent>

      {authenticated ? (
        <NavbarMenu className="bg-[var(--freee-surface)] pt-2">
          <p className="domain-label-accounting px-3 pb-1 text-[10px] font-bold tracking-wide">
            経理
          </p>
          {mobileItems
            .filter((item) => item.domain === "accounting")
            .map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <NavbarMenuItem key={item.href} isActive={active}>
                  <NextLink
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block w-full rounded-md px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-[var(--freee-blue)]/10 text-[var(--freee-blue)]"
                        : "text-[var(--freee-text)]"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </NextLink>
                </NavbarMenuItem>
              );
            })}
          <div className="mx-3 my-2 border-t border-[var(--freee-border)]" />
          <p className="domain-label-billing px-3 pb-1 text-[10px] font-bold tracking-wide">
            請求
          </p>
          {mobileItems
            .filter((item) => item.domain === "billing")
            .map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <NavbarMenuItem key={item.href} isActive={active}>
                  <NextLink
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block w-full rounded-md px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-[var(--freee-billing)]/10 text-[var(--freee-billing)]"
                        : "text-[var(--freee-text)]"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </NextLink>
                </NavbarMenuItem>
              );
            })}
        </NavbarMenu>
      ) : null}
    </Navbar>
  );
}
