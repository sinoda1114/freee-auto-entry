"use client";

import {
  Button,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import NextLink from "next/link";
import { ThemeToggle } from "./components/ThemeToggle";
import type { CompanyOption } from "./CompanySwitcher";
import { CompanySwitcher } from "./CompanySwitcher";
import { APP_NAME } from "@/lib/app-brand";
import { HeaderNav } from "./HeaderNav";

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
  return (
    <Navbar
      maxWidth="xl"
      isBordered
      height="3rem"
      classNames={{
        base: "min-h-12 border-b border-[var(--freee-border)] bg-[var(--freee-surface)]",
        wrapper: "h-12 gap-2 px-4 sm:px-5",
        item: "data-[active=true]:bg-transparent",
      }}
    >
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
    </Navbar>
  );
}
