import type { Metadata } from "next";
import Link from "next/link";
import { getInvoices } from "@/lib/freee/invoice";
import { getValidFreeeAuth } from "@/lib/freee/session-client";

const PAGE_SIZE = 100;

export const metadata: Metadata = {
  title: "請求書 | freee経理・請求管理",
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <p className="p-10 text-center">freeeへ再連携してください。</p>;
  }
  const query = await searchParams;
  const requestedPage = Number(query.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let invoices;
  try {
    invoices = await getInvoices(auth, {
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
  } catch (error) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-black">請求書</h1>
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">
          {error instanceof Error
            ? error.message
            : "請求書を取得できませんでした。"}
        </p>
      </section>
    );
  }

  const sorted = [...invoices].sort((left, right) => {
    if (left.sendingStatus === right.sendingStatus) {
      return right.billingDate.localeCompare(left.billingDate);
    }
    return left.sendingStatus === "unsent" ? -1 : 1;
  });
  const unsentCount = invoices.filter(
    (invoice) => invoice.sendingStatus === "unsent",
  ).length;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.2em] text-lime-700 uppercase dark:text-lime-400">
            Delivery control
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">請求書</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            送付待ちを先頭に表示します。送信後は再取得して状態を更新してください。
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/invoices"
            className="rounded-md border border-slate-300 px-4 py-3 text-sm font-bold dark:border-slate-700"
          >
            freeeから再取得
          </Link>
          <Link
            href="/invoices/new"
            className="rounded-md bg-lime-500 px-4 py-3 text-sm font-black text-slate-950"
          >
            ＋ 請求書を作成
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-amber-100 p-5 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p className="text-xs font-bold">送付待ち</p>
          <p className="mt-1 font-mono text-3xl font-black">{unsentCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">このページの請求書</p>
          <p className="mt-1 font-mono text-3xl font-black">{invoices.length}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {sorted.length === 0 ? (
          <p className="p-10 text-center text-slate-500 dark:text-slate-400">
            請求書はありません。
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {sorted.map((invoice) => (
              <article
                key={invoice.id}
                className="grid gap-4 p-5 md:grid-cols-[9rem_1fr_9rem_12rem] md:items-center"
              >
                <div>
                  <p className="font-mono text-sm font-black">
                    {invoice.billingDate}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <div>
                  <h2 className="font-black">
                    {invoice.subject || "件名なし"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {invoice.partnerName}
                    {invoice.paymentDate
                      ? ` / 期日 ${invoice.paymentDate}`
                      : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                    <span
                      className={
                        invoice.sendingStatus === "sent"
                          ? "rounded-full bg-green-100 px-2 py-1 text-green-800"
                          : "rounded-full bg-amber-100 px-2 py-1 text-amber-900"
                      }
                    >
                      {invoice.sendingStatus === "sent"
                        ? "送付済み"
                        : "送付待ち"}
                    </span>
                    {invoice.downloadedStatus && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {invoice.downloadedStatus === "downloaded"
                          ? "ダウンロード済み"
                          : "未ダウンロード"}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-right font-mono text-lg font-black">
                  {formatAmount(invoice.totalAmount)}
                </p>
                <a
                  href={invoice.reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-slate-950 px-4 py-2 text-center text-sm font-bold text-white hover:bg-lime-500 hover:text-slate-950 dark:bg-white dark:text-slate-950"
                >
                  freeeで確認・送付 ↗
                </a>
              </article>
            ))}
          </div>
        )}
      </div>

      <nav
        aria-label="請求書ページ送り"
        className="mt-6 flex items-center justify-between"
      >
        {page > 1 ? (
          <Link href={`/invoices?page=${page - 1}`} className="font-bold">
            ← 前へ
          </Link>
        ) : (
          <span />
        )}
        <span className="font-mono text-sm">PAGE {page}</span>
        {invoices.length === PAGE_SIZE ? (
          <Link href={`/invoices?page=${page + 1}`} className="font-bold">
            次へ →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  );
}
