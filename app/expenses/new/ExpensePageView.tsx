"use client";

import { Button } from "@heroui/react";
import NextLink from "next/link";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import { ExpenseForm } from "./ExpenseForm";

interface ExpensePageViewProps {
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
}

export function ExpensePageView({
  accountItems,
  taxCodes,
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
        description="領収書をカメラ撮影または選択すると OCR で自動入力し、freee 会計へ登録します。"
      />
      <div className="panel mt-4 px-4 py-4">
        <ExpenseForm accountItems={accountItems} taxCodes={taxCodes} />
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
        経費登録は
        {expenseCompanyName ? `「${expenseCompanyName}」` : "ワールスフォース"}
        専用です。ヘッダーで事業所を切り替えてから再度お試しください。
      </p>
    </PageShell>
  );
}
