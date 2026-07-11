"use client";

import { Button, Chip } from "@heroui/react";
import NextLink from "next/link";

const workflows = [
  {
    href: "/wallet-txns",
    title: "未処理明細",
    description: "自動登録ルール作成と freee 確定",
    badge: "経理",
  },
  {
    href: "/recurring-invoices",
    title: "定型請求",
    description: "テンプレートから月次作成",
    badge: "請求",
  },
  {
    href: "/invoices",
    title: "請求書",
    description: "送付待ちの確認",
    badge: "請求",
  },
] as const;

interface HomeDashboardProps {
  canRegisterExpense: boolean;
}

export function HomeDashboard({
  canRegisterExpense,
}: HomeDashboardProps) {
  return (
    <>
      <section className="grid gap-2 sm:grid-cols-3">
        {workflows.map((item) => (
          <NextLink
            key={item.href}
            href={item.href}
            className="panel group flex items-center gap-2.5 px-3 py-2.5 transition hover:border-[var(--freee-blue)]/45 hover:shadow-sm"
          >
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              classNames={{ content: "text-[10px] font-semibold px-1" }}
            >
              {item.badge}
            </Chip>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--freee-text)]">
                {item.title}
              </p>
              <p className="truncate text-xs text-[var(--freee-text-muted)]">
                {item.description}
              </p>
            </div>
            <span
              aria-hidden
              className="text-xs text-[var(--freee-text-muted)] transition group-hover:text-[var(--freee-blue)]"
            >
              →
            </span>
          </NextLink>
        ))}
      </section>

      <section className="panel px-3 py-3">
        <p className="text-xs font-semibold text-[var(--freee-text)]">
          クイックアクション
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {canRegisterExpense ? (
            <Button
              as={NextLink}
              href="/expenses/new"
              color="primary"
              size="sm"
            >
              経費を登録
            </Button>
          ) : (
            <p className="text-xs text-[var(--freee-text-muted)]">
              経費はワールスフォース選択時のみ
            </p>
          )}
          <Button
            as={NextLink}
            href="/invoices/new"
            size="sm"
            variant="bordered"
            className="border-[var(--freee-border)] text-[var(--freee-text)]"
          >
            請求書を作成
          </Button>
        </div>
      </section>
    </>
  );
}

export function HomeHero() {
  return (
    <section className="panel px-4 py-4">
      <p className="text-sm leading-relaxed text-[var(--freee-text-muted)]">
        未処理明細・定型請求・請求書送付を一画面から操作します。
      </p>
      <Button
        as={NextLink}
        href="/api/auth/login"
        color="primary"
        size="sm"
        className="mt-3 font-semibold"
      >
        freeeと連携する
      </Button>
    </section>
  );
}
