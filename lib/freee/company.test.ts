import { afterEach, describe, expect, it, vi } from "vitest";
import { getCompanies } from "./company";

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
