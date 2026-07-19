"use client";

import { Button, Chip } from "@heroui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { ReconcileInvoicesButton } from "@/app/components/ReconcileInvoicesButton";
import { reconcileRecurringInvoicesAction } from "@/app/recurring-invoices/actions";
import type { InvoiceSummary } from "@/lib/freee/invoice";
import { sortInvoicesByBillingDateDesc } from "@/lib/freee/invoice-list-utils";

interface InvoicesViewProps {
  companyId: string;
  invoices: InvoiceSummary[];
  page: number;
  unsentCount: number;
  unsettledCount: number;
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
  companyId,
  invoices,
  page,
  unsentCount,
  unsettledCount,
  hasNext,
}: InvoicesViewProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Already newest-first from server; keep unsent prioritization for ops.
  const sorted = [...sortInvoicesByBillingDateDesc(invoices)].sort(
    (left, right) => {
      if (left.sendingStatus === right.sendingStatus) {
        return 0;
      }
      return left.sendingStatus === "unsent" ? -1 : 1;
    },
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Delivery control"
        title="請求書"
        description="直近の請求書を最新順で表示します。再取得で freee と突合もします。"
        actions={
          <>
            <ReconcileInvoicesButton companyId={companyId} />
            <Button
              variant="bordered"
              size="sm"
              isLoading={isRefreshing}
              onPress={() => {
                void (async () => {
                  setRefreshMessage(null);
                  setRefreshError(null);
                  setIsRefreshing(true);
                  try {
                    const formData = new FormData();
                    formData.set("companyId", companyId);
                    const result = await reconcileRecurringInvoicesAction(
                      { status: "idle" },
                      formData,
                    );
                    if (result.status === "error") {
                      setRefreshError(
                        result.message ?? "再取得に失敗しました。",
                      );
                      return;
                    }
                    if (result.status === "success") {
                      setRefreshMessage(result.message ?? null);
                    }
                    router.refresh();
                  } finally {
                    setIsRefreshing(false);
                  }
                })();
              }}
            >
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

      {refreshMessage ? (
        <p className="mt-2 text-xs text-[var(--freee-text-muted)]">
          {refreshMessage}
        </p>
      ) : null}
      {refreshError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {refreshError}
        </p>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-[var(--radius-panel)] bg-amber-50 px-3 py-2.5 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide">
            送付待ち（直近）
          </p>
          <p className="stat-value mt-0.5">{unsentCount}</p>
        </div>
        <div className="rounded-[var(--radius-panel)] bg-orange-50 px-3 py-2.5 text-orange-950 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-100 dark:ring-orange-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide">
            未入金（直近）
          </p>
          <p className="stat-value mt-0.5">{unsettledCount}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--freee-text-muted)]">
            このページの請求書
          </p>
          <p className="stat-value mt-0.5">{invoices.length}</p>
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden shadow-sm">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-xs text-[var(--freee-text-muted)]">
              請求書はありません。
            </p>
            <Button
              as={NextLink}
              href="/invoices/new"
              color="primary"
              size="sm"
            >
              請求書を作成
            </Button>
          </div>
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
                    <Chip
                      size="sm"
                      variant="flat"
                      color={
                        invoice.paymentStatus === "settled"
                          ? "success"
                          : invoice.paymentStatus === "canceled"
                            ? "default"
                            : "warning"
                      }
                    >
                      {invoice.paymentStatus === "settled"
                        ? "入金済"
                        : invoice.paymentStatus === "canceled"
                          ? "決済キャンセル"
                          : "未入金"}
                    </Chip>
                    <Chip size="sm" variant="flat">
                      {invoice.dealStatus === "registered"
                        ? "取引登録済"
                        : "登録待ち"}
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
        <span className="font-mono text-sm text-[var(--freee-text-muted)]">
          PAGE {page}
        </span>
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
