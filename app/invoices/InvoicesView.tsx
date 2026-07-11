"use client";

import { Button, Chip } from "@heroui/react";
import NextLink from "next/link";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import type { InvoiceSummary } from "@/lib/freee/invoice";

interface InvoicesViewProps {
  invoices: InvoiceSummary[];
  page: number;
  unsentCount: number;
  hasNext: boolean;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function InvoicesView({
  invoices,
  page,
  unsentCount,
  hasNext,
}: InvoicesViewProps) {
  const sorted = [...invoices].sort((left, right) => {
    if (left.sendingStatus === right.sendingStatus) {
      return right.billingDate.localeCompare(left.billingDate);
    }
    return left.sendingStatus === "unsent" ? -1 : 1;
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Delivery control"
        title="請求書"
        description="送付待ちを先頭に表示します。送信後は再取得して状態を更新してください。"
        actions={
          <>
            <Button as={NextLink} href="/invoices" variant="bordered" size="sm">
              freeeから再取得
            </Button>
            <Button
              as={NextLink}
              href="/invoices/new"
              color="primary"
              size="sm"
            >
              ＋ 請求書を作成
            </Button>
          </>
        }
      />

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-[var(--radius-panel)] bg-amber-50 px-3 py-2.5 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide">
            送付待ち
          </p>
          <p className="stat-value mt-0.5">{unsentCount}</p>
        </div>
        <div className="panel px-3 py-2.5 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--freee-text-muted)]">
            このページの請求書
          </p>
          <p className="stat-value mt-0.5">{invoices.length}</p>
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden shadow-sm">
        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-[var(--freee-text-muted)]">
            請求書はありません。
          </p>
        ) : (
          <div className="divide-y divide-default-200">
            {sorted.map((invoice) => (
              <article
                key={invoice.id}
                className="grid gap-3 px-3 py-2.5 md:grid-cols-[7rem_1fr_7rem_10rem] md:items-center"
              >
                <div>
                  <p className="font-mono text-xs font-semibold">
                    {invoice.billingDate}
                  </p>
                  <p className="mt-1 text-xs text-[var(--freee-text-muted)]">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--freee-text)]">
                    {invoice.subject || "件名なし"}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--freee-text-muted)]">
                    {invoice.partnerName}
                    {invoice.paymentDate
                      ? ` / 期日 ${invoice.paymentDate}`
                      : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={
                        invoice.sendingStatus === "sent" ? "success" : "warning"
                      }
                    >
                      {invoice.sendingStatus === "sent"
                        ? "送付済み"
                        : "送付待ち"}
                    </Chip>
                    {invoice.downloadedStatus ? (
                      <Chip size="sm" variant="flat">
                        {invoice.downloadedStatus === "downloaded"
                          ? "ダウンロード済み"
                          : "未ダウンロード"}
                      </Chip>
                    ) : null}
                  </div>
                </div>
                <p className="text-right font-mono text-sm font-semibold">
                  {formatAmount(invoice.totalAmount)}
                </p>
                <div className="flex flex-col gap-2 md:items-stretch">
                  <Button
                    as="a"
                    href={invoice.reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    color="primary"
                    size="sm"
                    className="font-semibold"
                  >
                    freeeで確認・送付 ↗
                  </Button>
                  <Button
                    as={NextLink}
                    href={`/recurring-invoices/new?fromInvoiceId=${invoice.id}`}
                    variant="bordered"
                    size="sm"
                  >
                    テンプレート化
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <nav
        aria-label="請求書ページ送り"
        className="mt-4 flex items-center justify-between"
      >
        {page > 1 ? (
          <Button
            as={NextLink}
            href={`/invoices?page=${page - 1}`}
            variant="bordered"
            size="sm"
          >
            ← 前へ
          </Button>
        ) : (
          <span />
        )}
        <span className="font-mono text-sm text-[var(--freee-text-muted)]">PAGE {page}</span>
        {hasNext ? (
          <Button
            as={NextLink}
            href={`/invoices?page=${page + 1}`}
            variant="bordered"
            size="sm"
          >
            次へ →
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </PageShell>
  );
}
