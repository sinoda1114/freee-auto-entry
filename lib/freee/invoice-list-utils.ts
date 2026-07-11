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
