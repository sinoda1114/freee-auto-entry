import type { InvoiceSummary } from "./invoice";

export function sortInvoicesByBillingDateDesc(
  invoices: InvoiceSummary[],
): InvoiceSummary[] {
  return [...invoices].sort((left, right) => {
    const dateCompare = right.billingDate.localeCompare(left.billingDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return right.id - left.id;
  });
}

/** freee GET /invoices は古い順のため、UI 用に日付窓＋最新順ページングする。 */
export function billingDateWindowMonthsBack(
  monthsBack: number,
  now = new Date(),
): { startBillingDate: string; endBillingDate: string } {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - monthsBack, 1),
  );
  const toYmd = (value: Date) => value.toISOString().slice(0, 10);
  return {
    startBillingDate: toYmd(start),
    endBillingDate: toYmd(end),
  };
}

export function paginateInvoices(
  invoices: InvoiceSummary[],
  page: number,
  pageSize: number,
): { invoices: InvoiceSummary[]; hasNext: boolean; total: number } {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 100;
  const offset = (safePage - 1) * safeSize;
  const slice = invoices.slice(offset, offset + safeSize);
  return {
    invoices: slice,
    hasNext: offset + safeSize < invoices.length,
    total: invoices.length,
  };
}

export function filterInvoicesByQuery(
  invoices: InvoiceSummary[],
  query: string,
): InvoiceSummary[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return invoices;
  }

  return invoices.filter((invoice) => {
    const haystack = [
      invoice.subject,
      invoice.partnerName,
      invoice.invoiceNumber,
      invoice.billingDate,
      String(invoice.totalAmount),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
