import { describe, expect, it } from "vitest";
import { buildTemplatePrefillFromInvoice } from "./invoice-to-template";
import type { InvoiceDetail } from "./invoice";

const invoice: InvoiceDetail = {
  id: 42,
  companyId: "11122591",
  invoiceNumber: "INV-202606-001",
  subject: "6月分システム利用料",
  billingDate: "2026-06-30",
  paymentDate: "2026-07-31",
  sendingStatus: "sent",
  paymentStatus: "unsettled",
    dealStatus: "unregistered",
  totalAmount: 110000,
  partnerId: 87428281,
  partnerName: "株式会社Waalsforce",
  reportUrl: "https://invoice.secure.freee.co.jp/reports/invoices/42",
  emailTo: "billing@example.com",
  emailCc: "cc@example.com",
  sendingMethod: "email",
  templateId: 5,
  lines: [
    {
      description: "月次利用料",
      quantity: 1,
      unitPrice: 100000,
      taxRate: 10,
    },
  ],
};

describe("buildTemplatePrefillFromInvoice", () => {
  it("maps invoice fields into a template prefill", () => {
    expect(buildTemplatePrefillFromInvoice(invoice)).toEqual({
      name: "6月分システム利用料",
      partnerId: 87428281,
      partnerName: "株式会社Waalsforce",
      subject: "6月分システム利用料",
      emailTo: "billing@example.com",
      emailCc: "cc@example.com",
      sendingMethod: "email",
      invoiceTemplateId: 5,
      lines: invoice.lines,
    });
  });

  it("falls back to partner-based name when subject is blank", () => {
    expect(
      buildTemplatePrefillFromInvoice({ ...invoice, subject: "  " }).name,
    ).toBe("株式会社Waalsforce 請求");
  });
});
