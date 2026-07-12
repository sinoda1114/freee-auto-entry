import type { Metadata } from "next";
import { AuthGate } from "@/app/components/AuthGate";
import { appPageTitle } from "@/lib/app-brand";
import { listRecurringInvoiceTemplates } from "@/lib/db/recurring-invoices";
import { hasInvoiceGeneration } from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
import { getInvoices } from "@/lib/freee/invoice";
import {
  currentTargetMonth,
  formatTargetMonth,
} from "@/lib/freee/monthly-close-utils";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { getWalletTransactions } from "@/lib/freee/wallet";
import { isE2ETestMode, e2eInvoiceSummaries } from "@/lib/e2e/fixtures";
import type { RecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";
import { MonthlyCloseView } from "./MonthlyCloseView";

export const metadata: Metadata = {
  title: appPageTitle("月次確認"),
};

const WALLET_SCAN_LIMIT = 1_000;
const PAGE_SIZE = 100;

async function fetchUnprocessedWalletTxnCount(
  auth: { accessToken: string; companyId: string },
): Promise<number> {
  let count = 0;
  for (let offset = 0; offset < WALLET_SCAN_LIMIT; offset += PAGE_SIZE) {
    const batch = await getWalletTransactions(auth, {
      offset,
      limit: PAGE_SIZE,
    });
    count += batch.filter((t) => t.status === 1).length;
    if (batch.length < PAGE_SIZE) {
      break;
    }
  }
  return count;
}

async function fetchPendingTemplates(
  auth: { accessToken: string; companyId: string },
  targetMonth: string,
): Promise<RecurringInvoiceTemplate[]> {
  const db = getDatabase();
  const all = await listRecurringInvoiceTemplates(db, auth.companyId);
  const active = all.filter((t) => t.active);

  const results = await Promise.all(
    active.map(async (template) => {
      const generated = await hasInvoiceGeneration(db, {
        companyId: auth.companyId,
        templateId: template.id,
        targetMonth,
      });
      return generated ? null : template;
    }),
  );

  return results.filter((t): t is RecurringInvoiceTemplate => t !== null);
}

async function fetchUnsentInvoiceCount(
  auth: { accessToken: string; companyId: string },
): Promise<number> {
  if (isE2ETestMode()) {
    return e2eInvoiceSummaries.filter((i) => i.sendingStatus === "unsent")
      .length;
  }
  const invoices = await getInvoices(auth, { offset: 0, limit: PAGE_SIZE });
  return invoices.filter((i) => i.sendingStatus === "unsent").length;
}

export default async function MonthlyClosePage() {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <AuthGate
        title="月次確認"
        description="freeeへ再連携してから月次確認を行ってください。"
      />
    );
  }

  const targetMonth = currentTargetMonth();
  const formattedMonth = formatTargetMonth(targetMonth);

  const [walletResult, templateResult, invoiceResult] =
    await Promise.allSettled([
      fetchUnprocessedWalletTxnCount(auth),
      fetchPendingTemplates(auth, targetMonth),
      fetchUnsentInvoiceCount(auth),
    ]);

  return (
    <MonthlyCloseView
      data={{
        targetMonth,
        formattedMonth,
        unprocessedWalletTxns:
          walletResult.status === "fulfilled" ? walletResult.value : null,
        pendingTemplates:
          templateResult.status === "fulfilled" ? templateResult.value : null,
        unsentInvoiceCount:
          invoiceResult.status === "fulfilled" ? invoiceResult.value : null,
      }}
    />
  );
}
