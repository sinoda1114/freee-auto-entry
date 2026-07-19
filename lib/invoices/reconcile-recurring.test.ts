import { describe, expect, it } from "vitest";
import {
  billingDateInMonth,
  findMatchingInvoice,
  subjectsLikelyMatch,
} from "./reconcile-recurring";
import type { InvoiceSummary } from "@/lib/freee/invoice";

function invoice(
  overrides: Partial<InvoiceSummary> & Pick<InvoiceSummary, "id" | "subject" | "billingDate" | "partnerId">,
): InvoiceSummary {
  return {
    companyId: "1",
    invoiceNumber: "N-1",
    sendingStatus: "sent",
    paymentStatus: "unsettled",
    dealStatus: "unregistered",
    totalAmount: 1000,
    partnerName: "取引先",
    reportUrl: "https://example.com",
    ...overrides,
  };
}

describe("subjectsLikelyMatch", () => {
  it("matches ignoring whitespace", () => {
    expect(
      subjectsLikelyMatch("博報堂プロダクツ 7月分", "博報堂プロダクツ7月分"),
    ).toBe(true);
  });
});

describe("findMatchingInvoice", () => {
  it("picks partner+month+subject match", () => {
    const match = findMatchingInvoice(
      [
        invoice({
          id: 1,
          partnerId: 10,
          billingDate: "2026-06-01",
          subject: "別件",
        }),
        invoice({
          id: 2,
          partnerId: 10,
          billingDate: "2026-07-19",
          subject: "博報堂プロダクツ 7月分 開発案件",
        }),
      ],
      { partnerId: 10, subject: "博報堂プロダクツ 開発案件" },
      "2026-07",
    );
    expect(match?.id).toBe(2);
  });

  it("rejects wrong month", () => {
    expect(billingDateInMonth("2026-07-19", "2026-06")).toBe(false);
  });
});
