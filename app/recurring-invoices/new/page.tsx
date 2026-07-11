import Link from "next/link";
import { getPartners } from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { TemplateForm } from "../TemplateForm";

export default async function NewRecurringInvoicePage() {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <p className="p-10 text-center">freeeへ再連携してください。</p>;
  }
  const partners = await getPartners(auth);

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/recurring-invoices"
        className="text-sm font-bold text-slate-500 hover:text-lime-700"
      >
        ← 定型請求へ戻る
      </Link>
      <h1 className="mt-4 text-3xl font-black">定型請求を登録</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        請求日と入金期日は、実際に請求書を作るときに指定します。
      </p>
      <div className="mt-8">
        <TemplateForm companyId={auth.companyId} partners={partners} />
      </div>
    </section>
  );
}
