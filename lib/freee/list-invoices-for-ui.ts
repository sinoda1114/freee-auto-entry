import type { FreeeAuth } from "./accounting";
import {
  getInvoiceListPage,
  type InvoiceSummary,
} from "./invoice";
import {
  billingDateWindowMonthsBack,
  paginateInvoices,
  sortInvoicesByBillingDateDesc,
} from "./invoice-list-utils";
import { e2eInvoiceSummaries, isE2ETestMode } from "@/lib/e2e/fixtures";

export type ListInvoicesForUiResult = {
  invoices: InvoiceSummary[];
  hasNext: boolean;
  total: number;
  unsentCount: number;
  unsettledCount: number;
  startBillingDate: string;
  endBillingDate: string;
};

/**
 * freee 一覧 API は古い順のため、日付窓内を全件取得して最新順にページングする。
 * 取消済みは freee UI と同様に除外する。
 */
export async function listInvoicesForUi(
  auth: FreeeAuth,
  input: {
    page: number;
    pageSize: number;
    monthsBack?: number;
    now?: Date;
  },
): Promise<ListInvoicesForUiResult> {
  const monthsBack = input.monthsBack ?? 24;
  const window = billingDateWindowMonthsBack(monthsBack, input.now);

  const collected: InvoiceSummary[] = isE2ETestMode()
    ? [...e2eInvoiceSummaries]
    : await fetchAllInWindow(auth, window);

  const sorted = sortInvoicesByBillingDateDesc(collected);
  const page = paginateInvoices(sorted, input.page, input.pageSize);
  return {
    ...page,
    ...window,
    unsentCount: collected.filter((invoice) => invoice.sendingStatus === "unsent")
      .length,
    unsettledCount: collected.filter(
      (invoice) => invoice.paymentStatus === "unsettled",
    ).length,
  };
}

async function fetchAllInWindow(
  auth: FreeeAuth,
  window: { startBillingDate: string; endBillingDate: string },
): Promise<InvoiceSummary[]> {
  const collected: InvoiceSummary[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await getInvoiceListPage(auth, {
      offset,
      limit: 100,
      startBillingDate: window.startBillingDate,
      endBillingDate: window.endBillingDate,
      // Match freee UI: exclude canceled invoices from list / 送付待ち counts
      cancelStatus: "uncanceled",
    });
    collected.push(...page.invoices);
    if (page.invoices.length === 0 || page.fetchedCount < 100) {
      break;
    }
  }
  return collected;
}
