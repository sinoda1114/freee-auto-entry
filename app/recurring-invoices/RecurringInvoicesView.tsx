"use client";

import { Button, Chip } from "@heroui/react";
import NextLink from "next/link";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import type { RecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";
import { BulkGeneratePanel } from "./BulkGeneratePanel";
import { DeleteTemplateForm } from "./DeleteTemplateForm";
import { ToggleTemplateForm } from "./ToggleTemplateForm";

interface RecurringInvoicesViewProps {
  companyId: string;
  templates: RecurringInvoiceTemplate[];
  invoiceTemplateNames: Record<number, string>;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RecurringInvoicesView({
  companyId,
  templates,
  invoiceTemplateNames,
}: RecurringInvoicesViewProps) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Recurring billing"
        title="定型請求"
        description="必要な月だけ内容を確認して請求書を作成します。自動生成はしません。"
        actions={
          <>
            <Button
              as={NextLink}
              href="/recurring-invoices/from-invoice"
              variant="bordered"
              size="sm"
            >
              既存請求書から
            </Button>
            <Button
              as={NextLink}
              href="/recurring-invoices/new"
              color="primary"
            >
              ＋ 定型請求を登録
            </Button>
          </>
        }
      />

      <BulkGeneratePanel companyId={companyId} templates={templates} />

      <div className="mt-5 grid gap-2">
        {templates.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 border-dashed px-4 py-8 text-center">
            <p className="text-xs text-[var(--freee-text-muted)]">
              定型請求はまだありません。
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                as={NextLink}
                href="/recurring-invoices/new"
                color="primary"
                size="sm"
              >
                定型請求を登録
              </Button>
              <Button
                as={NextLink}
                href="/recurring-invoices/from-invoice"
                variant="bordered"
                size="sm"
              >
                既存請求書から
              </Button>
            </div>
          </div>
        ) : (
          templates.map((template) => {
            const subtotal = template.lines.reduce(
              (sum, line) => sum + line.quantity * line.unitPrice,
              0,
            );
            return (
              <article
                key={template.id}
                className="panel grid gap-3 px-3 py-2.5 shadow-sm md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--freee-text)]">{template.name}</h2>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={template.active ? "success" : "default"}
                    >
                      {template.active ? "有効" : "停止中"}
                    </Chip>
                  </div>
                  <p className="mt-1 text-xs text-[var(--freee-text-muted)]">
                    {template.partnerName} / {template.subject || "件名未設定"}
                  </p>
                  <p className="mt-1.5 font-mono text-sm font-semibold">
                    {formatAmount(subtotal)}{" "}
                    <span className="text-xs font-normal text-[var(--freee-text-muted)]">
                      ＋税
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--freee-text-muted)]">
                    {template.lines.length}明細・送付先{" "}
                    {template.emailTo || "取引先マスタ"}
                    {template.invoiceTemplateId
                      ? `・帳票 ${invoiceTemplateNames[template.invoiceTemplateId] ?? `ID ${template.invoiceTemplateId}`}`
                      : "・帳票 事業所既定"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {template.active ? (
                    <Button
                      as={NextLink}
                      href={`/recurring-invoices/${template.id}/create`}
                      color="primary"
                      size="sm"
                    >
                      今月作成する
                    </Button>
                  ) : null}
                  <Button
                    as={NextLink}
                    href={`/recurring-invoices/${template.id}/edit`}
                    variant="bordered"
                    size="sm"
                  >
                    編集
                  </Button>
                  <ToggleTemplateForm
                    companyId={companyId}
                    templateId={template.id}
                    active={template.active}
                  />
                  <DeleteTemplateForm
                    companyId={companyId}
                    templateId={template.id}
                    templateName={template.name}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
