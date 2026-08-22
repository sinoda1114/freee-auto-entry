import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractInvoiceMonthsBack,
  extractInvoiceSearchQuery,
  formatInvoicesForConsultationPrompt,
  listInvoicesForConsultation,
} from "./consultation-invoices";

vi.mock("@/lib/freee/list-invoices-for-ui", () => ({
  listInvoicesForUi: vi.fn(),
}));

import { listInvoicesForUi } from "@/lib/freee/list-invoices-for-ui";

const auth = { accessToken: "token", companyId: "11040830" };

describe("extractInvoiceSearchQuery", () => {
  it("takes the partner/subject before の請求書", () => {
    expect(
      extractInvoiceSearchQuery(
        "博報堂プロダクツの請求書をここ三ヶ月でリストアップして",
      ),
    ).toBe("博報堂プロダクツ");
  });
});

describe("extractInvoiceMonthsBack", () => {
  it("reads 三ヶ月 as 3", () => {
    expect(
      extractInvoiceMonthsBack("請求書をここ三ヶ月でリストアップして"),
    ).toBe(3);
  });

  it("reads numeric months", () => {
    expect(extractInvoiceMonthsBack("直近6ヶ月の請求書")).toBe(6);
  });
});

describe("formatInvoicesForConsultationPrompt", () => {
  it("includes rows and forbids wallet/ledger diversion", () => {
    const text = formatInvoicesForConsultationPrompt({
      monthsBack: 3,
      startBillingDate: "2026-05-01",
      endBillingDate: "2026-08-22",
      matchedCount: 1,
      returnedCount: 1,
      query: "博報堂プロダクツ",
      invoices: [
        {
          id: 1,
          invoiceNumber: "001",
          partnerName: "株式会社Waalsforce",
          subject: "博報堂プロダクツ 6月分",
          billingDate: "2026-06-10",
          totalAmount: 600000,
          sendingStatus: "sent",
          paymentStatus: "settled",
        },
      ],
    });
    expect(text).toContain("【事前取得した請求書データ】");
    expect(text).toContain("博報堂プロダクツ 6月分");
    expect(text).toContain("口座明細や総勘定元帳には切り替えない");
  });
});

describe("listInvoicesForConsultation", () => {
  afterEach(() => {
    vi.mocked(listInvoicesForUi).mockReset();
  });

  it("filters by partner/subject query within the billing window", async () => {
    vi.mocked(listInvoicesForUi).mockResolvedValue({
      invoices: [
        {
          id: 1,
          companyId: "11040830",
          invoiceNumber: "001",
          subject: "博報堂プロダクツ 6月分",
          billingDate: "2026-06-10",
          sendingStatus: "sent",
          paymentStatus: "settled",
          dealStatus: "registered",
          totalAmount: 600000,
          partnerId: 10,
          partnerName: "株式会社Waalsforce",
          reportUrl: "https://example.com/1",
        },
        {
          id: 2,
          companyId: "11040830",
          invoiceNumber: "002",
          subject: "別件",
          billingDate: "2026-07-01",
          sendingStatus: "unsent",
          paymentStatus: "unsettled",
          dealStatus: "unregistered",
          totalAmount: 1000,
          partnerId: 11,
          partnerName: "その他",
          reportUrl: "https://example.com/2",
        },
        {
          id: 3,
          companyId: "11040830",
          invoiceNumber: "003",
          subject: "7月分 開発案件",
          billingDate: "2026-07-21",
          sendingStatus: "sent",
          paymentStatus: "unsettled",
          dealStatus: "registered",
          totalAmount: 500000,
          partnerId: 10,
          partnerName: "株式会社Waalsforce",
          reportUrl: "https://example.com/3",
        },
      ],
      hasNext: false,
      total: 3,
      unsentCount: 1,
      unsettledCount: 2,
      startBillingDate: "2026-05-01",
      endBillingDate: "2026-08-22",
    });

    const result = await listInvoicesForConsultation(auth, {
      monthsBack: 3,
      query: "博報堂プロダクツ",
      limit: 10,
    });

    expect(listInvoicesForUi).toHaveBeenCalledWith(auth, {
      page: 1,
      pageSize: 1000,
      monthsBack: 3,
      now: undefined,
    });
    expect(result.matchedCount).toBe(1);
    expect(result.returnedCount).toBe(1);
    expect(result.query).toBe("博報堂プロダクツ");
    expect(result.invoices[0]?.subject).toContain("博報堂プロダクツ");
  });

  it("returns up to limit when query is empty", async () => {
    vi.mocked(listInvoicesForUi).mockResolvedValue({
      invoices: Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        companyId: "11040830",
        invoiceNumber: `00${index}`,
        subject: `件名${index}`,
        billingDate: "2026-08-01",
        sendingStatus: "sent" as const,
        paymentStatus: "settled" as const,
        dealStatus: "registered" as const,
        totalAmount: 1000 * (index + 1),
        partnerId: 1,
        partnerName: "テスト",
        reportUrl: `https://example.com/${index}`,
      })),
      hasNext: false,
      total: 5,
      unsentCount: 0,
      unsettledCount: 0,
      startBillingDate: "2026-05-01",
      endBillingDate: "2026-08-22",
    });

    const result = await listInvoicesForConsultation(auth, { limit: 2 });
    expect(result.matchedCount).toBe(5);
    expect(result.returnedCount).toBe(2);
    expect(result.monthsBack).toBe(3);
  });
});
