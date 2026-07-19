import { afterEach, describe, expect, it, vi } from "vitest";
import { listInvoicesForUi } from "./list-invoices-for-ui";

const auth = { accessToken: "token-abc", companyId: "11122591" };

function invoice(id: number, billingDate: string, subject: string) {
  return {
    id,
    company_id: 11122591,
    invoice_number: `INV-${id}`,
    subject,
    billing_date: billingDate,
    sending_status: "sent",
    payment_status: "unsettled",
    deal_status: "unregistered",
    total_amount: 22000,
    partner_id: 55,
    partner_name: "取引先A",
    report_url: `https://invoice.secure.freee.co.jp/reports/invoices/${id}`,
  };
}

describe("listInvoicesForUi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.E2E_TEST_MODE;
  });

  it("returns newest invoices on page 1 even when freee API is oldest-first", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoices: [
          invoice(1, "2024-10-31", "古い請求"),
          invoice(2, "2026-06-10", "中間の請求"),
          invoice(3, "2026-07-07", "最新の請求"),
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listInvoicesForUi(auth, {
      page: 1,
      pageSize: 2,
      now: new Date("2026-07-19T12:00:00Z"),
    });

    expect(result.invoices.map((row) => row.subject)).toEqual([
      "最新の請求",
      "中間の請求",
    ]);
    expect(result.hasNext).toBe(true);
    expect(result.total).toBe(3);
    expect(result.unsettledCount).toBe(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "start_billing_date=2024-07-01",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "end_billing_date=2026-07-19",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "cancel_status=uncanceled",
    );
  });

  it("keeps paging when soft-parse drops some rows in a full page", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) =>
      invoice(index + 1, "2026-01-01", `請求${index + 1}`),
    );
    fullPage[0] = { id: "broken" } as never;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: fullPage }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          invoices: [invoice(101, "2026-07-07", "最終ページ")],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listInvoicesForUi(auth, {
      page: 1,
      pageSize: 100,
      now: new Date("2026-07-19T12:00:00Z"),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(100);
    expect(result.invoices[0]?.subject).toBe("最終ページ");
  });
});
