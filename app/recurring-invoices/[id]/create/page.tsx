import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
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
  const template = await getRecurringInvoiceTemplate(
    getDatabase(),
    auth.companyId,
    id,
  );
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
      <p className="mt-5 font-mono text-xs font-bold tracking-[0.2em] text-lime-700 uppercase dark:text-lime-400">
        Review before create
      </p>
      <h1 className="mt-2 text-3xl font-black">{template.name}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        {template.partnerName}宛ての内容を今回分だけ編集し、確認後に作成します。
      </p>
      <div className="mt-8">
        <GenerateInvoiceForm companyId={auth.companyId} template={template} />
      </div>
    </section>
  );
}
