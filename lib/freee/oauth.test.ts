import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
} from "./oauth";

describe("buildAuthorizeUrl", () => {
  it("builds the freee authorize URL with required params", () => {
    const url = buildAuthorizeUrl({
      clientId: "client-123",
      redirectUri: "http://localhost:3000/api/auth/callback/freee",
      state: "state-abc",
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.secure.freee.co.jp/public_api/authorize",
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("client-123");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/freee",
    );
    expect(parsed.searchParams.get("state")).toBe("state-abc");
    expect(parsed.searchParams.get("prompt")).toBe("select_company");
  });
});

describe("exchangeCodeForToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the authorization_code grant and returns the token payload", async () => {
    const tokenPayload = {
      access_token: "access-xyz",
      token_type: "bearer",
      expires_in: 21600,
      refresh_token: "refresh-xyz",
      scope: "read write",
      company_id: 123,
      external_cid: "ext-1",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tokenPayload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeCodeForToken({
      clientId: "client-123",
      clientSecret: "secret-123",
      code: "auth-code",
      redirectUri: "http://localhost:3000/api/auth/callback/freee",
    });

    expect(result).toEqual({ ...tokenPayload, company_id: "123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://accounts.secure.freee.co.jp/public_api/token");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("client-123");
    expect(body.get("client_secret")).toBe("secret-123");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/freee",
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400 }),
    );

    await expect(
      exchangeCodeForToken({
        clientId: "client-123",
        clientSecret: "secret-123",
        code: "bad-code",
        redirectUri: "http://localhost:3000/api/auth/callback/freee",
      }),
    ).rejects.toThrow(/400/);
  });
});

describe("refreshAccessToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the refresh_token grant and returns the token payload", async () => {
    const tokenPayload = {
      access_token: "new-access",
      token_type: "bearer",
      expires_in: 21600,
      refresh_token: "new-refresh",
      scope: "read write",
      company_id: "123",
      external_cid: "ext-1",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tokenPayload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshAccessToken({
      clientId: "client-123",
      clientSecret: "secret-123",
      refreshToken: "old-refresh",
    });

    expect(result).toEqual(tokenPayload);
    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
  });
});
