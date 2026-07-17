import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDealCreateError,
  getCompanies,
  getCompanyFiscalYears,
  isDateInRegistrableRange,
  resolveRegistrableDateRange,
} from "./company";

describe("getCompanies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the company list for the given access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        companies: [
          { id: 11040830, name: "篠田 ITサービス", display_name: null, role: "admin" },
          {
            id: 11122591,
            name: "株式会社Waalsforce",
            display_name: "わーるずふぉーす",
            role: "admin",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const companies = await getCompanies("token-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.freee.co.jp/api/1/companies");
    expect(init.headers.Authorization).toBe("Bearer token-1");

    expect(companies).toEqual([
      { id: 11040830, name: "篠田 ITサービス", displayName: null },
      { id: 11122591, name: "株式会社Waalsforce", displayName: "わーるずふぉーす" },
    ]);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }),
    );

    await expect(getCompanies("bad-token")).rejects.toThrow(/401/);
  });

  it("throws a clear error when the response shape is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ companies: null }),
      }),
    );

    await expect(getCompanies("token-1")).rejects.toThrow(
      "freee companies API response is invalid",
    );
  });
});

describe("getCompanyFiscalYears", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps fiscal years from company detail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        company: {
          id: 1,
          fiscal_years: [
            {
              id: 10,
              start_date: "2025-06-01",
              end_date: "2026-05-31",
              is_closed: false,
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const years = await getCompanyFiscalYears({
      accessToken: "t",
      companyId: "11122591",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.freee.co.jp/api/1/companies/11122591",
    );
    expect(years).toEqual([
      {
        id: 10,
        startDate: "2025-06-01",
        endDate: "2026-05-31",
        isClosed: false,
        taxAccountMethod: null,
        taxMethod: null,
      },
    ]);
  });

  it("maps tax accounting method from fiscal years", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          company: {
            id: 1,
            fiscal_years: [
              {
                id: 10,
                start_date: "2024-06-01",
                end_date: "2025-05-31",
                is_closed: true,
                tax_account_method: 0,
                tax_method: 2,
              },
            ],
          },
        }),
      }),
    );
    const years = await getCompanyFiscalYears({
      accessToken: "t",
      companyId: "1",
    });
    expect(years[0]?.taxAccountMethod).toBe(0);
    expect(years[0]?.taxMethod).toBe(2);
  });
});

describe("resolveRegistrableDateRange", () => {
  it("prefers open year containing today", () => {
    const range = resolveRegistrableDateRange(
      [
        {
          id: 1,
          startDate: "2024-06-01",
          endDate: "2025-05-31",
          isClosed: true,
          taxAccountMethod: null,
          taxMethod: null,
        },
        {
          id: 2,
          startDate: "2025-06-01",
          endDate: "2026-05-31",
          isClosed: false,
          taxAccountMethod: null,
          taxMethod: null,
        },
      ],
      "2025-12-01",
    );
    expect(range).toEqual({
      startDate: "2025-06-01",
      endDate: "2026-05-31",
    });
  });

  it("falls back to latest open year when today is outside all", () => {
    const range = resolveRegistrableDateRange(
      [
        {
          id: 2,
          startDate: "2025-06-01",
          endDate: "2026-05-31",
          isClosed: false,
          taxAccountMethod: null,
          taxMethod: null,
        },
      ],
      "2026-07-12",
    );
    expect(range?.startDate).toBe("2025-06-01");
  });
});

describe("isDateInRegistrableRange / formatDealCreateError", () => {
  it("checks inclusive range", () => {
    const range = { startDate: "2025-06-01", endDate: "2026-05-31" };
    expect(isDateInRegistrableRange("2025-04-15", range)).toBe(false);
    expect(isDateInRegistrableRange("2025-06-01", range)).toBe(true);
  });

  it("translates fiscal-year API errors", () => {
    expect(
      formatDealCreateError(
        'freee accounting API request failed: 400 {"errors":[{"messages":["現在選択している会計年度の期首日以前の取引を登録することができません。"]}]}',
      ),
    ).toContain("期首より前");
  });
});
