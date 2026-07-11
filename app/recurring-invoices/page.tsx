import type { Metadata } from "next";
import Link from "next/link";
import { listRecurringInvoiceTemplates } from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { ToggleTemplateForm } from "./ToggleTemplateForm";

export const metadata: Metadata = {
  title: "定型請求 | freee経理・請求管理",
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function RecurringInvoicesPage() {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black">定型請求</h1>
        <p className="mt-4">freeeへ再連携してください。</p>
      </section>
    );
  }

  let templates;
  try {
    templates = await listRecurringInvoiceTemplates(
      getDatabase(),
      auth.companyId,
    );
  } catch (error) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-black">定型請求</h1>
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">
          {error instanceof Error
            ? error.message
            : "定型請求を取得できませんでした。"}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.2em] text-lime-700 uppercase dark:text-lime-400">
            Recurring billing
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">定型請求</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            必要な月だけ内容を確認して請求書を作成します。自動生成はしません。
          </p>
        </div>
        <Link
          href="/recurring-invoices/new"
          className="rounded-md bg-lime-500 px-5 py-3 font-black text-slate-950 hover:bg-lime-400"
        >
          ＋ 定型請求を登録
        </Link>
      </div>

      <div className="mt-8 grid gap-4">
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            定型請求はまだありません。
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
                className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">{template.name}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        template.active
                          ? "bg-lime-100 text-lime-900"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {template.active ? "有効" : "停止中"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {template.partnerName} / {template.subject || "件名未設定"}
                  </p>
                  <p className="mt-3 font-mono text-lg font-black">
                    {formatAmount(subtotal)} <span className="text-xs">＋税</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {template.lines.length}明細・送付先{" "}
                    {template.emailTo || "取引先マスタ"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {template.active && (
                    <Link
                      href={`/recurring-invoices/${template.id}/create`}
                      className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-lime-500 hover:text-slate-950 dark:bg-white dark:text-slate-950"
                    >
                      今月作成する
                    </Link>
                  )}
                  <Link
                    href={`/recurring-invoices/${template.id}/edit`}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700"
                  >
                    編集
                  </Link>
                  <ToggleTemplateForm
                    companyId={auth.companyId}
                    templateId={template.id}
                    active={template.active}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
