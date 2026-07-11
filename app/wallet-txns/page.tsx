import type { Metadata } from "next";
import Link from "next/link";
import {
  getAccountItems,
  getTaxCodes,
  getWalletables,
} from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  getUserMatchers,
  getWalletTransactions,
  matchUserMatcher,
  type UserMatcher,
  type WalletTransaction,
} from "@/lib/freee/wallet";
import { MatcherForm } from "./MatcherForm";

const PAGE_SIZE = 100;
const MAX_SCANNED_TRANSACTIONS = 5_000;

export const metadata: Metadata = {
  title: "未処理明細 | freee経理・請求管理",
};

async function getAllActiveMatchers(
  auth: { accessToken: string; companyId: string },
): Promise<UserMatcher[]> {
  const matchers: UserMatcher[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await getUserMatchers(auth, { offset, limit: PAGE_SIZE });
    matchers.push(...page);
    if (page.length < PAGE_SIZE) {
      return matchers;
    }
  }
}

function freeeWalletUrl(description: string): string {
  const filter = new URLSearchParams({
    ignore_condition: "with",
    description,
    limit: "500",
    sort: "issue_date",
    direction: "desc",
    offset: "0",
    page: "1",
  });
  return `https://secure.freee.co.jp/wallet_txns#${filter.toString()}`;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

async function loadWalletPageData(
  auth: { accessToken: string; companyId: string },
  page: number,
) {
  const [transactionScan, matchers, accountItems, taxCodes, walletables] =
    await Promise.all([
      (async () => {
        const unprocessed: WalletTransaction[] = [];
        const requiredCount = page * PAGE_SIZE + 1;
        let truncated = false;
        for (
          let offset = 0;
          offset < MAX_SCANNED_TRANSACTIONS;
          offset += PAGE_SIZE
        ) {
          const batch = await getWalletTransactions(auth, {
            offset,
            limit: PAGE_SIZE,
          });
          unprocessed.push(
            ...batch.filter((transaction) => transaction.status === 1),
          );
          if (batch.length < PAGE_SIZE) {
            break;
          }
          if (unprocessed.length >= requiredCount) {
            break;
          }
          if (offset + PAGE_SIZE >= MAX_SCANNED_TRANSACTIONS) {
            truncated = true;
          }
        }
        return { unprocessed, truncated };
      })(),
      getAllActiveMatchers(auth),
      getAccountItems(auth),
      getTaxCodes(auth),
      getWalletables(auth),
    ]);
  const start = (page - 1) * PAGE_SIZE;
  return {
    transactions: transactionScan.unprocessed.slice(
      start,
      start + PAGE_SIZE,
    ),
    hasNext: transactionScan.unprocessed.length > start + PAGE_SIZE,
    scanTruncated: transactionScan.truncated,
    matchers,
    accountItems,
    taxCodes,
    walletables,
  };
}

export default async function WalletTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black">未処理明細</h1>
        <p className="mt-4 text-slate-600">freeeへ再連携してください。</p>
        <a
          href="/api/auth/login"
          className="mt-6 inline-block rounded-md bg-slate-950 px-5 py-3 font-bold text-white"
        >
          freeeと連携
        </a>
      </section>
    );
  }

  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let data: Awaited<ReturnType<typeof loadWalletPageData>>;
  try {
    data = await loadWalletPageData(auth, page);
  } catch (error) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-black">未処理明細</h1>
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">
          {error instanceof Error
            ? error.message
            : "明細を取得できませんでした。"}
        </p>
      </section>
    );
  }

  const {
    transactions,
    hasNext,
    scanTruncated,
    matchers,
    accountItems,
    taxCodes,
    walletables,
  } = data;
  const walletableNames = new Map(
    walletables.map((walletable) => [walletable.id, walletable.name]),
  );

  return (
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-lime-700 uppercase dark:text-lime-400">
              Accounting queue
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              未処理明細
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
              未来の同一明細に使うルールをここで作り、今回分の確定だけfreeeで行います。
            </p>
          </div>
          <a
            href="https://secure.freee.co.jp/wallet_txns"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-bold hover:border-lime-500 dark:border-slate-700 dark:bg-slate-900"
          >
            freeeの明細一覧を開く ↗
          </a>
        </div>

        {scanTruncated && (
          <p
            role="status"
            className="mt-6 rounded-lg bg-amber-100 p-4 text-sm font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100"
          >
            最新5,000件までを検索しました。さらに古い未処理明細はfreeeの明細一覧で確認してください。
          </p>
        )}

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {transactions.length === 0 ? (
            <p className="p-10 text-center text-slate-500 dark:text-slate-400">
              このページに未処理明細はありません。
            </p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {transactions.map((transaction) => {
                const walletableName =
                  walletableNames.get(transaction.walletableId) ??
                  `${transaction.walletableType} #${transaction.walletableId}`;
                const matcher = matchUserMatcher(
                  transaction,
                  matchers,
                  walletableName,
                );
                return (
                  <article
                    key={transaction.id}
                    className="grid gap-5 p-5 lg:grid-cols-[8rem_1fr_10rem_18rem] lg:items-start"
                  >
                    <div>
                      <p className="font-mono text-sm font-bold">
                        {transaction.date}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ID {transaction.id}
                      </p>
                    </div>
                    <div>
                      <h2 className="font-bold">{transaction.description}</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {walletableName}
                      </p>
                      <p
                        className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          matcher
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {matcher
                          ? "ルールあり・今回分は登録待ち"
                          : "ルールなし"}
                      </p>
                      {matcher && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {matcher.accountItemName ?? "勘定科目未取得"} /{" "}
                          {matcher.taxName ?? "税区分未取得"}
                        </p>
                      )}
                    </div>
                    <p className="text-right font-mono text-lg font-black">
                      {formatAmount(transaction.amount)}
                    </p>
                    <div className="grid gap-2">
                      {!matcher && (
                        <MatcherForm
                          companyId={auth.companyId}
                          transaction={transaction}
                          walletableName={walletableName}
                          accountItems={accountItems}
                          taxCodes={taxCodes}
                        />
                      )}
                      <a
                        href={freeeWalletUrl(transaction.description)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-bold hover:border-lime-500 dark:border-slate-700"
                      >
                        今回分をfreeeで確定 ↗
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <nav
          aria-label="明細ページ送り"
          className="mt-6 flex items-center justify-between"
        >
          {page > 1 ? (
            <Link
              href={`/wallet-txns?page=${page - 1}`}
              className="rounded-md border border-slate-300 px-4 py-2 font-bold dark:border-slate-700"
            >
              ← 前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-sm">PAGE {page}</span>
          {hasNext ? (
            <Link
              href={`/wallet-txns?page=${page + 1}`}
              className="rounded-md border border-slate-300 px-4 py-2 font-bold dark:border-slate-700"
            >
              次へ →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </section>
  );
}
