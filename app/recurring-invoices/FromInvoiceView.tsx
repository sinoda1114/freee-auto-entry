"use client";

import { Button, Input } from "@heroui/react";
import NextLink from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import {
  filterInvoicesByQuery,
  sortInvoicesByBillingDateDesc,
} from "@/lib/freee/invoice-list-utils";
import type { InvoiceSummary } from "@/lib/freee/invoice";

interface FromInvoiceViewProps {
  invoices: InvoiceSummary[];
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FromInvoiceView({ invoices }: FromInvoiceViewProps) {
  const [query, setQuery] = useState("");
  const sortedInvoices = useMemo(
    () => sortInvoicesByBillingDateDesc(invoices),
    [invoices],
  );
  const filteredInvoices = useMemo(
    () => filterInvoicesByQuery(sortedInvoices, query),
    [sortedInvoices, query],
  );

  return (
    <PageShell width="lg">
      <Button
        as={NextLink}
        href="/recurring-invoices"
        variant="light"
        size="sm"
        className="mb-4 w-fit"
      >
        ← 定型請求へ戻る
      </Button>
      <PageHeader
        title="既存請求書からテンプレート登録"
        description="請求日が新しい順に表示します。freee の請求書を選び、定型請求テンプレートとして保存します。"
      />

      <div className="panel mt-4 overflow-hidden">
        <div className="border-b border-[var(--freee-border)] px-3 py-3">
          <Input
            aria-label="請求書を検索"
            placeholder="件名・取引先・請求書番号・請求日で検索"
            value={query}
            onValueChange={setQuery}
            size="sm"
            variant="bordered"
            classNames={{
              inputWrapper:
                "border-[var(--freee-border)] bg-[var(--freee-bg)]",
              input: "text-sm text-[var(--freee-text)]",
            }}
            isClearable
            onClear={() => setQuery("")}
          />
          <p className="mt-2 text-xs text-[var(--freee-text-muted)]">
            {filteredInvoices.length} 件
            {query.trim() ? ` / ${sortedInvoices.length} 件中` : ""}
          </p>
        </div>

        {sortedInvoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-[var(--freee-text-muted)]">
            コピー元にできる請求書がありません。
          </p>
        ) : filteredInvoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-[var(--freee-text-muted)]">
            検索条件に一致する請求書がありません。
          </p>
        ) : (
          <div className="divide-y divide-[var(--freee-border)]">
            {filteredInvoices.map((invoice) => (
              <article
                key={invoice.id}
                className="grid gap-3 px-3 py-3 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--freee-text)]">
                    {invoice.subject || "件名なし"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--freee-text-muted)]">
                    {invoice.partnerName} / {invoice.billingDate} /{" "}
                    {invoice.invoiceNumber}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold">
                    {formatAmount(invoice.totalAmount)}
                  </p>
                </div>
                <Button
                  as={NextLink}
                  href={`/recurring-invoices/new?fromInvoiceId=${invoice.id}`}
                  color="primary"
                  size="sm"
                >
                  テンプレートにする
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
