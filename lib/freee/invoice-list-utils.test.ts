import { describe, expect, it } from "vitest";
import {
  filterInvoicesByQuery,
  sortInvoicesByBillingDateDesc,
} from "./invoice-list-utils";
import type { InvoiceSummary } from "./invoice";

const baseInvoice: InvoiceSummary = {
  id: 1,
  companyId: "11122591",
  invoiceNumber: "INV-001",
  subject: "6月分システム利用料",
  billingDate: "2026-06-30",
  sendingStatus: "sent",
  paymentStatus: "unsettled",
    dealStatus: "unregistered",
  totalAmount: 110000,
  partnerId: 1,
  partnerName: "株式会社Waalsforce",
  reportUrl: "https://invoice.secure.freee.co.jp/reports/invoices/1",
};

describe("sortInvoicesByBillingDateDesc", () => {
  it("sorts newer billing dates first", () => {
    const sorted = sortInvoicesByBillingDateDesc([
      { ...baseInvoice, id: 1, billingDate: "2026-05-31" },
      { ...baseInvoice, id: 2, billingDate: "2026-07-31" },
      { ...baseInvoice, id: 3, billingDate: "2026-06-30" },
    ]);

    expect(sorted.map((invoice) => invoice.billingDate)).toEqual([
      "2026-07-31",
      "2026-06-30",
      "2026-05-31",
    ]);
  });
});

describe("filterInvoicesByQuery", () => {
  const invoices = [
    { ...baseInvoice, id: 1, partnerName: "株式会社Waalsforce" },
    {
      ...baseInvoice,
      id: 2,
      subject: "7月分コンサル",
      billingDate: "2026-07-31",
      partnerName: "Microsoft",
      invoiceNumber: "INV-002",
    },
  ];

  it("matches subject, partner, invoice number, and billing date", () => {
    expect(filterInvoicesByQuery(invoices, "waalsforce")).toHaveLength(1);
    expect(filterInvoicesByQuery(invoices, "INV-002")).toHaveLength(1);
    expect(filterInvoicesByQuery(invoices, "2026-06")).toHaveLength(1);
    expect(filterInvoicesByQuery(invoices, "コンサル")).toHaveLength(1);
  });

  it("returns all invoices when query is blank", () => {
    expect(filterInvoicesByQuery(invoices, "  ")).toHaveLength(2);
  });
});
