import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import {
  getLastInvoiceGenerationForTemplate,
  getRecurringInvoiceTemplate,
} from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
import { getInvoice } from "@/lib/freee/invoice";
import type { InvoiceDetail } from "@/lib/freee/invoice";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { GenerateInvoiceForm } from "../../GenerateInvoiceForm";

export default async function CreateRecurringInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <p className="p-10 text-center">freeeへ再連携してください。</p>;
  }
  const { id } = await params;
  const db = getDatabase();
  const template = await getRecurringInvoiceTemplate(db, auth.companyId, id);
  if (!template) {
    notFound();
  }

  let prevInvoice: InvoiceDetail | null = null;
  let prevTargetMonth: string | null = null;
  try {
    const lastGeneration = await getLastInvoiceGenerationForTemplate(
      db,
      auth.companyId,
      template.id,
    );
    if (lastGeneration) {
      prevTargetMonth = lastGeneration.targetMonth;
      prevInvoice = await getInvoice(auth, lastGeneration.invoiceId);
    }
  } catch {
    // Non-fatal: show form without diff if fetch fails
  }

  return (
    <PageShell width="lg">
      <Link
        href="/recurring-invoices"
        className="mb-4 inline-block text-sm text-[var(--freee-text-muted)] hover:text-[var(--freee-blue)]"
      >
        ← 定型請求へ戻る
      </Link>
      <PageHeader
        eyebrow="Review before create"
        title={template.name}
        description={`${template.partnerName} 宛ての内容を今回分だけ編集し、確認後に作成します。`}
      />
      <div className="panel mt-4 px-4 py-4">
        <GenerateInvoiceForm
          companyId={auth.companyId}
          template={template}
          prevInvoice={prevInvoice ?? undefined}
          prevTargetMonth={prevTargetMonth ?? undefined}
        />
      </div>
    </PageShell>
  );
}
