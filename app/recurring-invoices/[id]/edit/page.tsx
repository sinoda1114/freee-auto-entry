import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { getRecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
import { getPartners } from "@/lib/freee/accounting";
import { getInvoiceTemplates } from "@/lib/freee/invoice";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { TemplateForm } from "../../TemplateForm";

export default async function EditRecurringInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <p className="p-10 text-center">freeeへ再連携してください。</p>;
  }
  const { id } = await params;
  const [template, partners, invoiceTemplates] = await Promise.all([
    getRecurringInvoiceTemplate(getDatabase(), auth.companyId, id),
    getPartners(auth),
    getInvoiceTemplates(auth).catch(() => []),
  ]);
  if (!template) {
    notFound();
  }

  return (
    <PageShell width="lg">
      <Link
        href="/recurring-invoices"
        className="mb-4 inline-block text-sm text-[var(--freee-text-muted)] hover:text-[var(--freee-blue)]"
      >
        ← 定型請求へ戻る
      </Link>
      <PageHeader title="定型請求を編集" />
      <div className="panel mt-4 px-4 py-4">
        <TemplateForm
          companyId={auth.companyId}
          partners={partners}
          invoiceTemplates={invoiceTemplates}
          template={template}
        />
      </div>
    </PageShell>
  );
}
