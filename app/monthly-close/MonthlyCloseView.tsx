"use client";

import NextLink from "next/link";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import type { RecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";

interface ChecklistItemProps {
  label: string;
  href: string;
  count: number | null;
  unit: string;
  okLabel: string;
}

function ChecklistItem({ label, href, count, unit, okLabel }: ChecklistItemProps) {
  const isDone = count === 0;
  const isUnknown = count === null;

  return (
    <NextLink
      href={href}
      className="panel group flex items-center gap-3 px-4 py-3.5 transition hover:border-[var(--freee-blue)]/40 hover:shadow-sm"
    >
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUnknown
            ? "bg-[var(--freee-bg)] text-[var(--freee-text-muted)]"
            : isDone
              ? "bg-success-100 text-success-700"
              : "bg-warning-100 text-warning-700"
        }`}
      >
        {isUnknown ? "–" : isDone ? "✓" : "!"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--freee-text)]">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--freee-text-muted)]">
          {isUnknown
            ? "取得できませんでした"
            : isDone
              ? okLabel
              : `${count}${unit}あります`}
        </p>
      </div>

      <span
        aria-hidden
        className="text-xs text-[var(--freee-text-muted)] transition group-hover:text-[var(--freee-blue)]"
      >
        →
      </span>
    </NextLink>
  );
}

interface PendingTemplateListProps {
  templates: RecurringInvoiceTemplate[];
}

function PendingTemplateList({ templates }: PendingTemplateListProps) {
  if (templates.length === 0) {
    return null;
  }

  return (
    <ul className="mt-1.5 space-y-1 pl-9">
      {templates.map((template) => (
        <li key={template.id} className="text-xs text-[var(--freee-text-muted)]">
          <span className="mr-1 text-warning-500">·</span>
          {template.name}（{template.partnerName}）
        </li>
      ))}
    </ul>
  );
}

export interface MonthlyCloseData {
  targetMonth: string;
  formattedMonth: string;
  unprocessedWalletTxns: number | null;
  pendingTemplates: RecurringInvoiceTemplate[] | null;
  unsentInvoiceCount: number | null;
}

interface MonthlyCloseViewProps {
  data: MonthlyCloseData;
}

export function MonthlyCloseView({ data }: MonthlyCloseViewProps) {
  const {
    formattedMonth,
    unprocessedWalletTxns,
    pendingTemplates,
    unsentInvoiceCount,
  } = data;

  const allClear =
    unprocessedWalletTxns === 0 &&
    pendingTemplates !== null &&
    pendingTemplates.length === 0 &&
    unsentInvoiceCount === 0;

  return (
    <PageShell width="md">
      <PageHeader
        eyebrow={formattedMonth}
        title="月次確認"
        description="今月の経理タスクをまとめて確認できます。"
      />

      {allClear && (
        <div className="mt-4 rounded-xl bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
          今月のタスクはすべて完了しています。お疲れ様でした！
        </div>
      )}

      <div className="mt-5 space-y-2">
        <p className="section-label">チェックリスト</p>

        <ChecklistItem
          label="未処理明細"
          href="/wallet-txns"
          count={unprocessedWalletTxns}
          unit="件"
          okLabel="未処理の明細はありません"
        />

        <div>
          <NextLink
            href="/recurring-invoices"
            className="panel group flex items-center gap-3 px-4 py-3.5 transition hover:border-[var(--freee-blue)]/40 hover:shadow-sm"
          >
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                pendingTemplates === null
                  ? "bg-[var(--freee-bg)] text-[var(--freee-text-muted)]"
                  : pendingTemplates.length === 0
                    ? "bg-success-100 text-success-700"
                    : "bg-warning-100 text-warning-700"
              }`}
            >
              {pendingTemplates === null
                ? "–"
                : pendingTemplates.length === 0
                  ? "✓"
                  : "!"}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--freee-text)]">
                定型請求の月次作成
              </p>
              <p className="mt-0.5 text-xs text-[var(--freee-text-muted)]">
                {pendingTemplates === null
                  ? "取得できませんでした"
                  : pendingTemplates.length === 0
                    ? "今月の定型請求はすべて作成済みです"
                    : `${pendingTemplates.length}件が未作成です`}
              </p>
            </div>

            <span
              aria-hidden
              className="text-xs text-[var(--freee-text-muted)] transition group-hover:text-[var(--freee-blue)]"
            >
              →
            </span>
          </NextLink>

          {pendingTemplates && pendingTemplates.length > 0 && (
            <PendingTemplateList templates={pendingTemplates} />
          )}
        </div>

        <ChecklistItem
          label="請求書の送付"
          href="/invoices"
          count={unsentInvoiceCount}
          unit="件"
          okLabel="送付待ちの請求書はありません"
        />
      </div>
    </PageShell>
  );
}
