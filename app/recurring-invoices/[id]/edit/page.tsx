import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
import { getPartners } from "@/lib/freee/accounting";
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
  const [template, partners] = await Promise.all([
    getRecurringInvoiceTemplate(getDatabase(), auth.companyId, id),
    getPartners(auth),
  ]);
  if (!template) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/recurring-invoices"
        className="text-sm font-bold text-slate-500 hover:text-lime-700"
      >
        ← 定型請求へ戻る
      </Link>
      <h1 className="mt-4 text-3xl font-black">定型請求を編集</h1>
      <div className="mt-8">
        <TemplateForm
          companyId={auth.companyId}
          partners={partners}
          template={template}
        />
      </div>
    </section>
  );
}
