import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDeal,
  getAccountItems,
  getPartners,
  getTaxCodes,
  getWalletables,
} from "./accounting";

const auth = { accessToken: "token-abc", companyId: "999" };

describe("accounting API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getAccountItems fetches account items for the company", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ account_items: [{ id: 1, name: "消耗品費" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await getAccountItems(auth);

    expect(items).toEqual([{ id: 1, name: "消耗品費" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/1/account_items");
    expect(url).toContain("company_id=999");
    expect(init.headers.Authorization).toBe("Bearer token-abc");
  });

  it("getTaxCodes returns only available tax codes with the Japanese label", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        taxes: [
          {
            code: 136,
            name: "purchase_with_tax_10",
            name_ja: "課対仕入10%",
            available: true,
          },
          {
            code: 1,
            name: "taxable",
            name_ja: "課税",
            available: false,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await getTaxCodes(auth);

    expect(items).toEqual([{ code: 136, name: "課対仕入10%" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/1/taxes/companies/999");
  });

  it("getWalletables fetches wallet accounts for the company", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ walletables: [{ id: 1, name: "普通預金" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await getWalletables(auth);

    expect(items).toEqual([{ id: 1, name: "普通預金" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/1/walletables");
    expect(url).toContain("company_id=999");
  });

  it("getPartners fetches business partners for the company", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ partners: [{ id: 1, name: "株式会社サンプル" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await getPartners(auth);

    expect(items).toEqual([{ id: 1, name: "株式会社サンプル" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/1/partners");
    expect(url).toContain("company_id=999");
  });

  it("createDeal posts a deal with freee-mcp memo tag omitted when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deal: { id: 42 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createDeal(auth, {
      issueDate: "2026-07-11",
      accountItemId: 10,
      taxCode: 1,
      amount: 5000,
      description: "テスト経費",
    });

    expect(result).toEqual({ id: 42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/1/deals");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.company_id).toBe(999);
    expect(body.type).toBe("expense");
    expect(body.issue_date).toBe("2026-07-11");
    expect(body.details).toEqual([
      {
        account_item_id: 10,
        tax_code: 1,
        amount: 5000,
        description: "テスト経費",
      },
    ]);
  });

  it("throws when the API responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "invalid params",
      }),
    );

    await expect(getAccountItems(auth)).rejects.toThrow(/422/);
  });
});
