import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInvoice,
  getInvoice,
  getInvoiceTemplates,
  getInvoices,
  getUnsentInvoiceCount,
} from "./invoice";

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

  it("posts template_id when a document template is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoice: { id: 2, report_url: "https://invoice.secure.freee.co.jp/reports/invoices/2" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createInvoice(auth, {
      billingDate: "2026-07-11",
      partnerId: 55,
      templateId: 12,
      lines: [{ description: "月次", quantity: 1, unitPrice: 1000, taxRate: 10 }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.template_id).toBe(12);
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

  it("sends a generated invoice_number on the first create attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoice: {
          id: 9,
          report_url: "https://invoice.secure.freee.co.jp/reports/invoices/9",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createInvoiceResilient } = await import("./invoice");
    const result = await createInvoiceResilient(auth, {
      billingDate: "2026-07-19",
      partnerId: 55,
      lines: [
        { description: "月次", quantity: 1, unitPrice: 1000, taxRate: 10 },
      ],
    });

    expect(result.id).toBe(9);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.invoice_number).toMatch(/^20260719-55-/);
  });

  it("retries without invoice_number when auto-numbering forbids a supplied number", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            errors: [
              {
                messages: [
                  "自動採番するので、invoice_number は指定できません。",
                ],
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          invoice: {
            id: 10,
            report_url: "https://invoice.secure.freee.co.jp/reports/invoices/10",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { createInvoiceResilient } = await import("./invoice");
    const result = await createInvoiceResilient(auth, {
      billingDate: "2026-07-19",
      partnerId: 55,
      lines: [
        { description: "月次", quantity: 1, unitPrice: 1000, taxRate: 10 },
      ],
    });

    expect(result.id).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(secondBody.invoice_number).toBeUndefined();
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

  it("skips invalid rows instead of failing the whole list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoices: [
          { id: "broken" },
          {
            id: 2,
            company_id: 999,
            invoice_number: 2026070023,
            subject: "有効な請求",
            billing_date: "2026-07-07",
            sending_status: "sent",
            payment_status: "unsettled",
            total_amount: 22000,
            partner_id: 55,
            partner_name: "取引先A",
            report_url:
              "https://invoice.secure.freee.co.jp/reports/invoices/2",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const invoices = await getInvoices(auth, { offset: 0, limit: 100 });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.invoiceNumber).toBe("2026070023");
  });
});

describe("getUnsentInvoiceCount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts unsent invoices across every page", async () => {
    const invoice = (id: number, sendingStatus: "sent" | "unsent") => ({
      id,
      company_id: 999,
      invoice_number: `INV-${id}`,
      subject: `${id}月分`,
      billing_date: "2026-07-31",
      sending_status: sendingStatus,
      payment_status: "unsettled",
      total_amount: 110000,
      partner_id: 55,
      partner_name: "取引先A",
      report_url: `https://invoice.secure.freee.co.jp/reports/invoices/${id}`,
    });
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      invoice(index + 1, index === 0 ? "unsent" : "sent"),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: firstPage }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: [invoice(101, "unsent")] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUnsentInvoiceCount(auth)).resolves.toBe(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("offset=0&limit=100");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("offset=100&limit=100");
  });
});

describe("getInvoice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns invoice detail with billable lines", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoice: {
          id: 42,
          company_id: 999,
          invoice_number: "INV-001",
          subject: "7月分",
          billing_date: "2026-07-31",
          sending_status: "unsent",
          payment_status: "unsettled",
          total_amount: 110000,
          partner_id: 55,
          partner_name: "取引先A",
          partner_contact_email_to: "billing@example.com",
          partner_contact_email_cc: "",
          partner_sending_method: "email",
          template_id: 12,
          report_url: "https://invoice.secure.freee.co.jp/reports/invoices/42",
          lines: [
            {
              type: "text",
              description: "注意書き",
            },
            {
              description: "月次利用料",
              quantity: 1,
              unit_price: "100000",
              tax_rate: 10,
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const invoice = await getInvoice(auth, 42);

    expect(invoice.lines).toEqual([
      {
        description: "月次利用料",
        quantity: 1,
        unitPrice: 100000,
        taxRate: 10,
      },
    ]);
    expect(invoice.templateId).toBe(12);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.freee.co.jp/iv/invoices/42?company_id=999",
    );
  });
});

describe("getInvoiceTemplates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns available invoice document templates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        templates: [
          { id: 1, name: "標準テンプレート" },
          { id: 2, name: "English" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const templates = await getInvoiceTemplates(auth);

    expect(templates).toEqual([
      { id: 1, name: "標準テンプレート" },
      { id: 2, name: "English" },
    ]);
  });
});
