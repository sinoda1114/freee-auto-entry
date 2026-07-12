import Link from "next/link";
import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { getAccountItems, getTaxCodes } from "@/lib/freee/accounting";
import { isExpenseCompany } from "@/lib/freee/company-policy";
import {
  getConnectedCompanies,
  getValidFreeeAuth,
} from "@/lib/freee/session-client";
import {
  decodeSuicaHandoffPayload,
  pickTravelAccountItemId,
  type SuicaTransitItem,
} from "@/lib/suica/history";
import { ExpenseBlockedView } from "../new/ExpensePageView";
import { SuicaExpenseView } from "./SuicaExpenseView";

function parseItems(encoded: string | undefined): {
  items: SuicaTransitItem[];
  error?: string;
} {
  if (!encoded) {
    return { items: [] };
  }
  try {
    return { items: decodeSuicaHandoffPayload(encoded).items };
  } catch (error) {
    return {
      items: [],
      error:
        error instanceof Error
          ? error.message
          : "引き渡しデータの読み取りに失敗しました。",
    };
  }
}

export default async function SuicaExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const auth = await getValidFreeeAuth();
  const { p } = await searchParams;
  const { items, error: payloadError } = parseItems(p);

  if (!auth) {
    const returnTo = p
      ? `/expenses/suica?p=${encodeURIComponent(p)}`
      : "/expenses/suica";
    return (
      <AuthGate
        title="Suica交通履歴から経費登録"
        description="freeeとの連携が切れています。ログイン後、Androidアプリから再度開いてください。"
        returnTo={returnTo}
      />
    );
  }

  if (!isExpenseCompany(auth.companyId)) {
    const { companies } = await getConnectedCompanies();
    const expenseCompany = companies.find((company) =>
      isExpenseCompany(company.companyId),
    );
    return (
      <ExpenseBlockedView expenseCompanyName={expenseCompany?.companyName} />
    );
  }

  const [accountItems, taxCodes] = await Promise.all([
    getAccountItems(auth),
    getTaxCodes(auth),
  ]);
  const defaultAccountItemId = pickTravelAccountItemId(accountItems);
  const defaultAccount = accountItems.find(
    (item) => item.id === defaultAccountItemId,
  );
  const defaultTaxCode =
    defaultAccount != null
      ? (taxCodes.find((t) => t.code === defaultAccount.defaultTaxCode)?.code ??
        null)
      : null;

  return (
    <PageShell width="md">
      <Link
        href="/expenses/new"
        className="mb-4 inline-flex w-fit items-center rounded-md px-2 py-1 text-sm text-[var(--freee-text-muted)] hover:bg-[var(--freee-bg)] hover:text-[var(--freee-text)]"
      >
        ← 経費登録に戻る
      </Link>
      <PageHeader
        title="Suica交通履歴から経費登録"
        description="CSVの取り込み、または Android アプリでかざした履歴から、旅費交通費として freee に登録します。"
      />
      {payloadError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {payloadError}
        </p>
      ) : null}
      <SuicaExpenseView
        items={items}
        accountItems={accountItems}
        taxCodes={taxCodes}
        defaultAccountItemId={defaultAccountItemId}
        defaultTaxCode={defaultTaxCode}
      />
    </PageShell>
  );
}
