"use client";

import { Button } from "@heroui/react";
import NextLink from "next/link";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import { ExpenseForm } from "./ExpenseForm";

interface RecentExpenseRow {
  id: number;
  issueDate: string;
  amount: number;
  description: string | null;
  accountItemName: string | null;
}

interface ExpensePageViewProps {
  companyId: string;
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
  recentExpenses: RecentExpenseRow[];
  recentExpensesUnavailable: boolean;
}

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function RecentExpenses({
  expenses,
  unavailable,
}: {
  expenses: RecentExpenseRow[];
  unavailable: boolean;
}) {
  return (
    <section className="panel mt-4 px-4 py-3" aria-labelledby="recent-expenses-heading">
      <h2
        id="recent-expenses-heading"
        className="text-xs font-semibold text-[var(--freee-text)]"
      >
        最近登録した経費
      </h2>
      {unavailable ? (
        <p className="mt-2 text-sm text-[var(--freee-text-muted)]">
          直近の経費を表示できませんでした。
        </p>
      ) : expenses.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--freee-text-muted)]">
          まだ登録した経費はありません。
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {expenses.map((expense) => {
            const detail = [
              expense.accountItemName,
              expense.description ?? "摘要なし",
            ]
              .filter((part): part is string => Boolean(part))
              .join(" · ");
            return (
              <li
                key={expense.id}
                className="border-t border-[var(--freee-border)] pt-2 first:border-t-0 first:pt-0"
              >
                <p className="flex items-baseline justify-between gap-3 text-sm text-[var(--freee-text)]">
                  <span>{expense.issueDate}</span>
                  <span className="font-semibold">{yen(expense.amount)}</span>
                </p>
                <p className="truncate text-xs text-[var(--freee-text-muted)]">
                  {detail}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ExpensePageView({
  companyId,
  accountItems,
  taxCodes,
  recentExpenses,
  recentExpensesUnavailable,
}: ExpensePageViewProps) {
  return (
    <PageShell width="md">
      <Button
        as={NextLink}
        href="/"
        variant="light"
        size="sm"
        className="mb-4 w-fit"
      >
        ← トップに戻る
      </Button>
      <PageHeader
        title="経費を登録"
        description="領収書をカメラ撮影または選択すると OCR で自動入力し、freee 会計へ登録します。登録と同時に、出金元口座は役員資金で決済します。"
      />
      <p className="mt-3 text-sm text-[var(--freee-text-muted)]">
        Suica の履歴は{" "}
        <NextLink
          href="/expenses/suica"
          className="text-freee-blue underline-offset-2 hover:underline"
        >
          Suica経費登録
        </NextLink>
        で CSV 取り込み（または Android でかざし）できます。こちらも役員資金で決済します。
      </p>
      <RecentExpenses
        expenses={recentExpenses}
        unavailable={recentExpensesUnavailable}
      />
      <div className="panel mt-4 px-4 py-4">
        <ExpenseForm
          companyId={companyId}
          accountItems={accountItems}
          taxCodes={taxCodes}
        />
      </div>
    </PageShell>
  );
}

interface ExpenseBlockedViewProps {
  expenseCompanyName?: string;
}

export function ExpenseBlockedView({
  expenseCompanyName,
}: ExpenseBlockedViewProps) {
  return (
    <PageShell width="md">
      <Button
        as={NextLink}
        href="/"
        variant="light"
        size="sm"
        className="mb-4 w-fit"
      >
        ← トップに戻る
      </Button>
      <PageHeader title="経費を登録" />
      <p className="mt-4 text-[var(--freee-text-muted)]">
        経費登録は対応事業所のみ利用できます
        {expenseCompanyName ? `（例: 「${expenseCompanyName}」）` : ""}
        。ヘッダーで事業所を切り替えてから再度お試しください。
      </p>
    </PageShell>
  );
}
