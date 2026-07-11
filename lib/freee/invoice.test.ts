import { afterEach, describe, expect, it, vi } from "vitest";
import { createInvoice, getInvoices } from "./invoice";

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
      paymentDate: "2026-08-31",
      partnerId: 55,
      subject: "7月分ご請求",
      emailTo: "billing@example.com",
      emailCc: "owner@example.com",
      sendingMethod: "email",
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
    expect(body.payment_date).toBe("2026-08-31");
    expect(body.subject).toBe("7月分ご請求");
    expect(body.partner_contact_email_to).toBe("billing@example.com");
    expect(body.partner_contact_email_cc).toBe("owner@example.com");
    expect(body.partner_sending_method).toBe("email");
    expect(body.partner_id).toBe(55);
    expect(body.lines).toEqual([
      {
        description: "コンサルティング費用",
        quantity: 1,
        unit_price: "100000",
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

describe("getInvoices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns typed invoice sending and download statuses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoices: [
          {
            id: 1,
            company_id: 999,
            invoice_number: "INV-001",
            subject: "7月分",
            billing_date: "2026-07-31",
            payment_date: "2026-08-31",
            sending_status: "unsent",
            payment_status: "unsettled",
            total_amount: 110000,
            partner_id: 55,
            partner_name: "取引先A",
            email_url_file_downloaded_status: "undownloaded",
            report_url:
              "https://invoice.secure.freee.co.jp/reports/invoices/1",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const invoices = await getInvoices(auth, { offset: 0, limit: 100 });

    expect(invoices[0]).toMatchObject({
      id: 1,
      sendingStatus: "unsent",
      downloadedStatus: "undownloaded",
      partnerName: "取引先A",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "company_id=999&offset=0&limit=100",
    );
  });
});
