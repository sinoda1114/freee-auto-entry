"use client";

import { Button, Chip } from "@heroui/react";
import NextLink from "next/link";
import { useState } from "react";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import { matchUserMatcher, type UserMatcher, type WalletTransaction } from "@/lib/freee/wallet";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import {
  FREEE_WALLET_TXNS_LIST_URL,
  freeeWalletTxnStreamUrlFor,
} from "@/lib/freee/wallet-url";
import { MatcherRulePanel, MatcherRuleTrigger } from "./MatcherForm";

interface WalletTransactionsViewProps {
  companyId: string;
  page: number;
  hasNext: boolean;
  scanTruncated: boolean;
  transactions: WalletTransaction[];
  matchers: UserMatcher[];
  suggestionMatchers: UserMatcher[];
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
  walletableNames: Record<string, string>;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

export function WalletTransactionsView({
  companyId,
  page,
  hasNext,
  scanTruncated,
  transactions,
  matchers,
  suggestionMatchers,
  accountItems,
  taxCodes,
  walletableNames,
}: WalletTransactionsViewProps) {
  const [openMatcherTxnId, setOpenMatcherTxnId] = useState<number | null>(null);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Accounting queue"
        title="未処理明細"
        description="freeeの既存ルールから勘定科目・税区分をおすすめ表示します。今回分の確定は freee で行います。"
        actions={
          <Button
            as="a"
            href={FREEE_WALLET_TXNS_LIST_URL}
            target="_blank"
            rel="noreferrer"
            variant="bordered"
          >
            freeeの明細一覧 ↗
          </Button>
        }
      />

      {scanTruncated ? (
        <p
          role="status"
          className="mt-4 rounded-[var(--radius-panel)] bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          最新5,000件までを検索しました。さらに古い未処理明細は freee
          の明細一覧で確認してください。
        </p>
      ) : null}

      <div className="panel mt-4 overflow-hidden shadow-sm">
        {transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-[var(--freee-text-muted)]">
            このページに未処理明細はありません。
          </p>
        ) : (
          <div className="divide-y divide-default-200">
            {transactions.map((transaction) => {
              const walletableName =
                walletableNames[String(transaction.walletableId)] ??
                `${transaction.walletableType} #${transaction.walletableId}`;
              const matcher = matchUserMatcher(
                transaction,
                matchers,
                walletableName,
              );
              return (
                <article
                  key={transaction.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2"
                >
                  <time
                    dateTime={transaction.date}
                    className="w-[4.75rem] shrink-0 font-mono text-xs font-semibold tabular-nums"
                  >
                    {transaction.date}
                  </time>
                  <div className="min-w-0 flex-1 basis-[12rem]">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h2
                        className="min-w-0 truncate text-sm font-semibold text-[var(--freee-text)]"
                        title={transaction.description}
                      >
                        {transaction.description}
                      </h2>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={matcher ? "warning" : "default"}
                        className="h-5 shrink-0"
                      >
                        {matcher ? "登録待ち" : "ルール未設定"}
                      </Chip>
                    </div>
                    <p className="truncate text-xs text-[var(--freee-text-muted)]">
                      {walletableName}
                      {matcher
                        ? ` · ${matcher.accountItemName ?? "勘定科目未取得"} / ${matcher.taxName ?? "税区分未取得"}`
                        : null}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {formatAmount(transaction.amount)}
                  </p>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {!matcher ? (
                      <MatcherRuleTrigger
                        open={openMatcherTxnId === transaction.id}
                        onToggle={() =>
                          setOpenMatcherTxnId((current) =>
                            current === transaction.id ? null : transaction.id,
                          )
                        }
                      />
                    ) : null}
                    <Button
                      as="a"
                      href={freeeWalletTxnStreamUrlFor(transaction)}
                      target="_blank"
                      rel="noreferrer"
                      variant="bordered"
                      size="sm"
                      className="shrink-0 font-semibold"
                    >
                      freeeで確定 ↗
                    </Button>
                  </div>
                  {!matcher && openMatcherTxnId === transaction.id ? (
                    <MatcherRulePanel
                      key={transaction.id}
                      companyId={companyId}
                      transaction={transaction}
                      walletableName={walletableName}
                      accountItems={accountItems}
                      taxCodes={taxCodes}
                      suggestionMatchers={suggestionMatchers}
                      open
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <nav
        aria-label="明細ページ送り"
        className="mt-4 flex items-center justify-between"
      >
        {page > 1 ? (
          <Button
            as={NextLink}
            href={`/wallet-txns?page=${page - 1}`}
            variant="bordered"
            size="sm"
          >
            ← 前へ
          </Button>
        ) : (
          <span />
        )}
        <span className="font-mono text-sm text-[var(--freee-text-muted)]">PAGE {page}</span>
        {hasNext ? (
          <Button
            as={NextLink}
            href={`/wallet-txns?page=${page + 1}`}
            variant="bordered"
            size="sm"
          >
            次へ →
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </PageShell>
  );
}
