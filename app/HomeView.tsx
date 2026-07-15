"use client";

import { Button } from "@heroui/react";
import NextLink from "next/link";

type Domain = "accounting" | "billing" | "support";

type Workflow = {
  href: string;
  title: string;
  description: string;
  domain: Domain;
};

function buildAccountingWorkflows(canRegisterExpense: boolean): Workflow[] {
  const items: Workflow[] = [
    {
      href: "/monthly-close",
      title: "月次確認",
      description: "今月の経理タスクをまとめて確認",
      domain: "accounting",
    },
    {
      href: "/wallet-txns",
      title: "未処理明細",
      description: "自動登録ルール作成と freee 確定",
      domain: "accounting",
    },
  ];

  if (canRegisterExpense) {
    items.push({
      href: "/expenses/new",
      title: "経費（領収書OCR）",
      description: "カメラ撮影で自動入力して登録",
      domain: "accounting",
    });
  }

  return items;
}

const billingWorkflows: Workflow[] = [
  {
    href: "/recurring-invoices",
    title: "定型請求",
    description: "テンプレートから月次作成",
    domain: "billing",
  },
  {
    href: "/invoices",
    title: "請求書",
    description: "送付待ちの確認",
    domain: "billing",
  },
];

const supportWorkflows: Workflow[] = [
  {
    href: "/support",
    title: "問い合わせ履歴",
    description: "freee全サービスの問い合わせを蓄積・検索・再調査",
    domain: "support",
  },
];

function WorkflowCard({ item }: { item: Workflow }) {
  const isAccounting = item.domain === "accounting";
  const isBilling = item.domain === "billing";
  return (
    <NextLink
      href={item.href}
      className={`panel group flex items-center gap-2.5 border-l-[3px] px-3 py-2.5 transition hover:shadow-sm ${
        isAccounting
          ? "border-l-freee-blue hover:border-freee-blue/45"
          : isBilling
            ? "border-l-freee-billing hover:border-freee-billing/45"
            : "border-l-[var(--freee-text-muted)] hover:border-[var(--freee-text)]"
      }`}
    >
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          isAccounting
            ? "bg-freee-blue-soft text-freee-blue"
            : isBilling
              ? "bg-freee-billing-soft text-freee-billing"
              : "bg-[var(--freee-bg)] text-[var(--freee-text)]"
        }`}
      >
        {isAccounting ? "経理" : isBilling ? "請求" : "問い合わせ"}
      </span>
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
        className={`text-xs text-[var(--freee-text-muted)] transition ${
          isAccounting
            ? "group-hover:text-freee-blue"
            : isBilling
              ? "group-hover:text-freee-billing"
              : "group-hover:text-[var(--freee-text)]"
        }`}
      >
        →
      </span>
    </NextLink>
  );
}

function WorkflowGroup({
  title,
  domain,
  items,
}: {
  title: string;
  domain: Domain;
  items: Workflow[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2
          className={`text-xs font-bold tracking-wide ${
            domain === "accounting"
              ? "text-freee-blue"
              : domain === "billing"
                ? "text-freee-billing"
                : "text-[var(--freee-text)]"
          }`}
        >
          {title}
        </h2>
        <span
          aria-hidden
          className="h-px flex-1 bg-[var(--freee-border)]"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <WorkflowCard key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}

interface HomeDashboardProps {
  canRegisterExpense: boolean;
}

export function HomeDashboard({
  canRegisterExpense,
}: HomeDashboardProps) {
  const accounting = buildAccountingWorkflows(canRegisterExpense);

  return (
    <>
      <div className="flex flex-col gap-5">
        <WorkflowGroup title="経理" domain="accounting" items={accounting} />
        <WorkflowGroup title="請求" domain="billing" items={billingWorkflows} />
        <WorkflowGroup
          title="問い合わせ"
          domain="support"
          items={supportWorkflows}
        />
      </div>

      <section className="panel mt-5 px-3 py-3">
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
              経費を撮影・登録
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
            className="bg-freee-billing text-white data-[hover=true]:opacity-90"
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
