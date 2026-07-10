import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDeal,
  getAccountItems,
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

  it("getTaxCodes fetches tax codes for the company", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ taxes: [{ code: 1, name: "課税仕入10%" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await getTaxCodes(auth);

    expect(items).toEqual([{ code: 1, name: "課税仕入10%" }]);
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
