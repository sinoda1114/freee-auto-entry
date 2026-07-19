import { formatTokyoDate } from "@/lib/date";
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
  // Invoice forms use Asia/Tokyo calendar dates; keep the fetch window on the same day.
  const endBillingDate = formatTokyoDate(now);
  const endYear = Number(endBillingDate.slice(0, 4));
  const endMonth = Number(endBillingDate.slice(5, 7));
  const startMonthIndex = endYear * 12 + (endMonth - 1) - monthsBack;
  const startYear = Math.floor(startMonthIndex / 12);
  const startMonth = (startMonthIndex % 12) + 1;
  const startBillingDate = `${String(startYear).padStart(4, "0")}-${String(startMonth).padStart(2, "0")}-01`;
  return {
    startBillingDate,
    endBillingDate,
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
