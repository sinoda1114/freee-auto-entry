import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { appPageTitle } from "@/lib/app-brand";
import { countSupportThreadsByTargetIds } from "@/lib/db/support-threads";
import { getDatabase } from "@/lib/db/turso";
import {
  getAccountItems,
  getTaxCodes,
  getWalletables,
} from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  getAllUserMatchersForActs,
  getUserMatchers,
  getWalletTransactions,
  type UserMatcher,
  type WalletTransaction,
} from "@/lib/freee/wallet";
import { WalletTransactionsView } from "./WalletTransactionsView";

const PAGE_SIZE = 100;
const MAX_SCANNED_TRANSACTIONS = 5_000;

export const metadata = {
  title: appPageTitle("未処理明細"),
};

async function getAllActiveMatchers(
  auth: { accessToken: string; companyId: string },
): Promise<UserMatcher[]> {
  const matchers: UserMatcher[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await getUserMatchers(auth, {
      offset,
      limit: PAGE_SIZE,
      act: 1,
    });
    matchers.push(...page);
    if (page.length < PAGE_SIZE) {
      return matchers;
    }
  }
}

async function loadWalletPageData(
  auth: { accessToken: string; companyId: string },
  page: number,
) {
  const [transactionScan, matchers, suggestionMatchers, accountItems, taxCodes, walletables] =
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
      getAllUserMatchersForActs(auth),
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
    suggestionMatchers,
    accountItems,
    taxCodes,
    walletableNames: Object.fromEntries(
      walletables.map((walletable) => [String(walletable.id), walletable.name]),
    ),
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
      <AuthGate
        title="未処理明細"
        description="freeeへ再連携してから未処理明細を確認してください。"
      />
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
      <PageShell width="md">
        <PageHeader title="未処理明細" />
        <p role="alert" className="mt-6 rounded-xl bg-danger-50 p-4 text-danger">
          {error instanceof Error
            ? error.message
            : "明細を取得できませんでした。"}
        </p>
      </PageShell>
    );
  }

  let supportCountsByTxnId: Record<number, number> = {};
  try {
    supportCountsByTxnId = await countSupportThreadsByTargetIds(
      getDatabase(),
      auth.companyId,
      "wallet_txn",
      data.transactions.map((transaction) => transaction.id),
    );
  } catch {
    supportCountsByTxnId = {};
  }

  return (
    <WalletTransactionsView
      companyId={auth.companyId}
      page={page}
      hasNext={data.hasNext}
      scanTruncated={data.scanTruncated}
      transactions={data.transactions}
      matchers={data.matchers}
      suggestionMatchers={data.suggestionMatchers}
      accountItems={data.accountItems}
      taxCodes={data.taxCodes}
      walletableNames={data.walletableNames}
      supportCountsByTxnId={supportCountsByTxnId}
    />
  );
}
