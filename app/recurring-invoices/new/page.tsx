import { getPartners } from "@/lib/freee/accounting";
import { getInvoice, getInvoiceTemplates } from "@/lib/freee/invoice";
import { buildTemplatePrefillFromInvoice } from "@/lib/freee/invoice-to-template";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import Link from "next/link";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { TemplateForm } from "../TemplateForm";

export default async function NewRecurringInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ fromInvoiceId?: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <p className="p-10 text-center">freeeへ再連携してください。</p>;
  }
  const [partners, invoiceTemplates] = await Promise.all([
    getPartners(auth),
    getInvoiceTemplates(auth).catch(() => []),
  ]);
  const query = await searchParams;
  const fromInvoiceId = Number(query.fromInvoiceId);
  let prefill;
  let sourceLabel: string | undefined;
  if (Number.isInteger(fromInvoiceId) && fromInvoiceId > 0) {
    try {
      const invoice = await getInvoice(auth, fromInvoiceId);
      prefill = buildTemplatePrefillFromInvoice(invoice);
      sourceLabel = `請求書 ${invoice.invoiceNumber}（${invoice.billingDate}）の内容をコピーしました。管理名などを確認して登録してください。`;
    } catch {
      sourceLabel =
        "請求書の内容を取得できませんでした。空のフォームから登録してください。";
    }
  }

  return (
    <PageShell width="lg">
      <Link
        href={prefill ? "/recurring-invoices/from-invoice" : "/recurring-invoices"}
        className="mb-4 inline-block text-sm text-[var(--freee-text-muted)] hover:text-[var(--freee-blue)]"
      >
        {prefill ? "← 請求書一覧へ戻る" : "← 定型請求へ戻る"}
      </Link>
      <PageHeader
        title="定型請求を登録"
        description="請求日と入金期日は、実際に請求書を作るときに指定します。"
        actions={
          prefill ? undefined : (
            <Link
              href="/recurring-invoices/from-invoice"
              className="inline-flex h-8 items-center rounded-md border border-[var(--freee-border)] px-3 text-xs font-semibold text-[var(--freee-text)] hover:border-[var(--freee-blue)]"
            >
              既存請求書からコピー
            </Link>
          )
        }
      />
      <div className="panel mt-4 px-4 py-4">
        <TemplateForm
          companyId={auth.companyId}
          partners={partners}
          invoiceTemplates={invoiceTemplates}
          prefill={prefill}
          sourceLabel={sourceLabel}
        />
      </div>
    </PageShell>
  );
}
