import { afterEach, describe, expect, it, vi } from "vitest";
import { createInvoice } from "./invoice";

const auth = { accessToken: "token-abc", companyId: "999" };

describe("createInvoice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts an invoice to the freee invoice API and returns the created invoice", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoice: { id: 1, report_url: "https://invoice.secure.freee.co.jp/reports/invoices/1" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createInvoice(auth, {
      billingDate: "2026-07-11",
      partnerId: 55,
      lines: [
        {
          description: "コンサルティング費用",
          quantity: 1,
          unitPrice: 100000,
          taxRate: 10,
        },
      ],
      memoTagIds: [7],
    });

    expect(result).toEqual({
      id: 1,
      reportUrl: "https://invoice.secure.freee.co.jp/reports/invoices/1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.freee.co.jp/iv/invoices");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-abc");

    const body = JSON.parse(init.body as string);
    expect(body.company_id).toBe(999);
    expect(body.billing_date).toBe("2026-07-11");
    expect(body.partner_id).toBe(55);
    expect(body.lines).toEqual([
      {
        description: "コンサルティング費用",
        quantity: 1,
        unit_price: 100000,
        tax_rate: 10,
        tag_ids: [7],
      },
    ]);
  });

  it("throws when the API responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "invalid partner_id",
      }),
    );

    await expect(
      createInvoice(auth, {
        billingDate: "2026-07-11",
        partnerId: 1,
        lines: [],
      }),
    ).rejects.toThrow(/422/);
  });
});
