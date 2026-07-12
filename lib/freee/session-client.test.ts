import { afterEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const refreshAccessTokenMock = vi.fn();
const headersMock = vi.fn();
const redirectMock = vi.fn((..._args: string[]) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/lib/session", () => ({
  getSession: () => getSessionMock(),
}));
vi.mock("./oauth", () => ({
  refreshAccessToken: (...args: unknown[]) => refreshAccessTokenMock(...args),
}));
vi.mock("./config", () => ({
  getFreeeOAuthConfig: () => ({
    clientId: "client-1",
    clientSecret: "secret-1",
    redirectUri: "http://localhost:3000/api/auth/callback/freee",
  }),
}));
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

import {
  getConnectedCompanies,
  getValidFreeeAuth,
  saveCompanyConnection,
  switchActiveCompany,
} from "./session-client";

describe("getValidFreeeAuth", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no session", async () => {
    getSessionMock.mockResolvedValue({});
    const auth = await getValidFreeeAuth();
    expect(auth).toBeNull();
  });

  it("returns the current token when it has not expired", async () => {
    getSessionMock.mockResolvedValue({
      accessToken: "token-1",
      companyId: "999",
      expiresAt: Date.now() + 60_000,
    });

    const auth = await getValidFreeeAuth();

    expect(auth).toEqual({ accessToken: "token-1", companyId: "999" });
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it("refreshes and persists a new token when expired", async () => {
    const session = {
      accessToken: "old-token",
      refreshToken: "refresh-1",
      companyId: "999",
      expiresAt: Date.now() - 1000,
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);
    refreshAccessTokenMock.mockResolvedValue({
      access_token: "new-token",
      refresh_token: "new-refresh",
      expires_in: 21600,
      company_id: "999",
    });

    const auth = await getValidFreeeAuth();

    expect(refreshAccessTokenMock).toHaveBeenCalledWith({
      clientId: "client-1",
      clientSecret: "secret-1",
      refreshToken: "refresh-1",
    });
    expect(session.save).toHaveBeenCalledTimes(2);
    expect(auth).toEqual({ accessToken: "new-token", companyId: "999" });
  });

  it("redirects to the refresh route when cookies cannot be written during render", async () => {
    const session = {
      accessToken: "old-token",
      refreshToken: "refresh-1",
      companyId: "999",
      expiresAt: Date.now() - 1000,
      save: vi
        .fn()
        .mockRejectedValueOnce(
          new Error(
            "Cookies can only be modified in a Server Action or Route Handler.",
          ),
        ),
    };
    getSessionMock.mockResolvedValue(session);
    headersMock.mockResolvedValueOnce({
      get: (name: string) => (name === "x-pathname" ? "/expenses/new" : null),
    });

    await expect(getValidFreeeAuth()).rejects.toThrow("NEXT_REDIRECT");
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(
      "/api/auth/refresh?returnTo=%2Fexpenses%2Fnew",
    );
  });

  it("returns null when expired and there is no refresh token", async () => {
    getSessionMock.mockResolvedValue({
      accessToken: "old-token",
      companyId: "999",
      expiresAt: Date.now() - 1000,
    });

    const auth = await getValidFreeeAuth();
    expect(auth).toBeNull();
  });

  it("syncs the refreshed token back into the matching companies entry", async () => {
    const session = {
      accessToken: "old-token",
      refreshToken: "refresh-1",
      companyId: "999",
      expiresAt: Date.now() - 1000,
      companies: [
        {
          companyId: "999",
          companyName: "Acme",
          accessToken: "old-token",
          refreshToken: "refresh-1",
          expiresAt: Date.now() - 1000,
        },
        {
          companyId: "888",
          companyName: "Other Co",
          accessToken: "other-token",
          refreshToken: "other-refresh",
          expiresAt: Date.now() + 60_000,
        },
      ],
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);
    refreshAccessTokenMock.mockResolvedValue({
      access_token: "new-token",
      refresh_token: "new-refresh",
      expires_in: 21600,
      company_id: "999",
    });

    await getValidFreeeAuth();

    expect(session.companies[0]).toMatchObject({
      companyId: "999",
      accessToken: "new-token",
      refreshToken: "new-refresh",
    });
    // 他事業所のエントリは変更されない
    expect(session.companies[1]).toMatchObject({
      companyId: "888",
      accessToken: "other-token",
    });
    expect(session.save).toHaveBeenCalledTimes(2);
  });
});

describe("saveCompanyConnection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds a new company connection and sets it as active", async () => {
    const session: Record<string, unknown> = {
      oauthState: "state-abc",
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);

    await saveCompanyConnection({
      companyId: "999",
      companyName: "Acme",
      accessToken: "token-1",
      refreshToken: "refresh-1",
      expiresIn: 21600,
    });

    expect(session.companyId).toBe("999");
    expect(session.accessToken).toBe("token-1");
    expect(session.refreshToken).toBe("refresh-1");
    expect(session.oauthState).toBeUndefined();
    expect(session.companies).toEqual([
      expect.objectContaining({
        companyId: "999",
        companyName: "Acme",
        accessToken: "token-1",
        refreshToken: "refresh-1",
      }),
    ]);
    expect(session.save).toHaveBeenCalledTimes(1);
  });

  it("replaces an existing connection for the same company instead of duplicating it", async () => {
    const session: Record<string, unknown> = {
      companies: [
        {
          companyId: "999",
          companyName: "Old Name",
          accessToken: "old-token",
          refreshToken: "old-refresh",
          expiresAt: 111,
        },
      ],
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);

    await saveCompanyConnection({
      companyId: "999",
      companyName: "New Name",
      accessToken: "new-token",
      refreshToken: "new-refresh",
      expiresIn: 21600,
    });

    expect(session.companies).toHaveLength(1);
    expect(session.companies).toEqual([
      expect.objectContaining({ companyId: "999", companyName: "New Name" }),
    ]);
  });

  it("migrates a legacy top-level session into companies before adding another company", async () => {
    const session: Record<string, unknown> = {
      companyId: "999",
      accessToken: "legacy-token",
      refreshToken: "legacy-refresh",
      expiresAt: 111,
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);

    await saveCompanyConnection({
      companyId: "888",
      companyName: "Other Co",
      accessToken: "new-token",
      refreshToken: "new-refresh",
      expiresIn: 21600,
    });

    expect(session.companies).toHaveLength(2);
    expect(session.companies).toEqual([
      expect.objectContaining({
        companyId: "999",
        companyName: "事業所 999",
        accessToken: "legacy-token",
      }),
      expect.objectContaining({
        companyId: "888",
        companyName: "Other Co",
        accessToken: "new-token",
      }),
    ]);
    expect(session.companyId).toBe("888");
  });
});

describe("switchActiveCompany", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("switches the active company when it is already connected", async () => {
    const session: Record<string, unknown> = {
      companyId: "999",
      accessToken: "token-999",
      companies: [
        {
          companyId: "999",
          companyName: "Acme",
          accessToken: "token-999",
          refreshToken: "refresh-999",
          expiresAt: Date.now() + 60_000,
        },
        {
          companyId: "888",
          companyName: "Other Co",
          accessToken: "token-888",
          refreshToken: "refresh-888",
          expiresAt: Date.now() + 60_000,
        },
      ],
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);

    const result = await switchActiveCompany("888");

    expect(result).toEqual({ ok: true });
    expect(session.companyId).toBe("888");
    expect(session.accessToken).toBe("token-888");
    expect(session.save).toHaveBeenCalledTimes(1);
  });

  it("switches legacy connections whose company id was stored as a number", async () => {
    const session: Record<string, unknown> = {
      companyId: 999,
      accessToken: "token-999",
      companies: [
        {
          companyId: 888,
          companyName: "Other Co",
          accessToken: "token-888",
          refreshToken: "refresh-888",
          expiresAt: Date.now() + 60_000,
        },
      ],
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);

    const result = await switchActiveCompany("888");

    expect(result).toEqual({ ok: true });
    expect(session.companyId).toBe("888");
    expect(session.save).toHaveBeenCalledTimes(1);
  });

  it("returns not-connected when the company has no saved connection", async () => {
    getSessionMock.mockResolvedValue({
      companyId: "999",
      companies: [],
      save: vi.fn(),
    });

    const result = await switchActiveCompany("777");

    expect(result).toEqual({ ok: false, reason: "not-connected" });
  });

  it("refreshes the token when switching to a company with an expired access token", async () => {
    const session: Record<string, unknown> = {
      companyId: "999",
      accessToken: "token-999",
      companies: [
        {
          companyId: "999",
          companyName: "Acme",
          accessToken: "token-999",
          refreshToken: "refresh-999",
          expiresAt: Date.now() + 60_000,
        },
        {
          companyId: "888",
          companyName: "Other Co",
          accessToken: "expired-token",
          refreshToken: "refresh-888",
          expiresAt: Date.now() - 1000,
        },
      ],
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);
    refreshAccessTokenMock.mockResolvedValue({
      access_token: "refreshed-token",
      refresh_token: "refreshed-refresh",
      expires_in: 21600,
      company_id: "888",
    });

    const result = await switchActiveCompany("888");

    expect(result).toEqual({ ok: true });
    expect(refreshAccessTokenMock).toHaveBeenCalledWith({
      clientId: "client-1",
      clientSecret: "secret-1",
      refreshToken: "refresh-888",
    });
    expect(session.accessToken).toBe("refreshed-token");
    expect(session.companyId).toBe("888");
  });

  it("keeps the current company active when refreshing the target company fails", async () => {
    const session: Record<string, unknown> = {
      companyId: "999",
      accessToken: "token-999",
      refreshToken: "refresh-999",
      expiresAt: Date.now() + 60_000,
      companies: [
        {
          companyId: "999",
          companyName: "Acme",
          accessToken: "token-999",
          refreshToken: "refresh-999",
          expiresAt: Date.now() + 60_000,
        },
        {
          companyId: "888",
          companyName: "Other Co",
          accessToken: "expired-token",
          refreshToken: "refresh-888",
          expiresAt: Date.now() - 1000,
        },
      ],
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);
    refreshAccessTokenMock.mockRejectedValue(new Error("refresh rejected"));

    const result = await switchActiveCompany("888");

    expect(result).toEqual({ ok: false, reason: "refresh-failed" });
    expect(session.companyId).toBe("999");
    expect(session.accessToken).toBe("token-999");
    expect(session.save).not.toHaveBeenCalled();
  });
});

describe("getConnectedCompanies", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the connected companies and active company id", async () => {
    getSessionMock.mockResolvedValue({
      companyId: "888",
      companies: [
        {
          companyId: "999",
          companyName: "Acme",
          accessToken: "t1",
          refreshToken: "r1",
          expiresAt: 1,
        },
        {
          companyId: "888",
          companyName: "Other Co",
          accessToken: "t2",
          refreshToken: "r2",
          expiresAt: 2,
        },
      ],
    });

    const result = await getConnectedCompanies();

    expect(result).toEqual({
      companies: [
        { companyId: "999", companyName: "Acme" },
        { companyId: "888", companyName: "Other Co" },
      ],
      activeCompanyId: "888",
    });
  });

  it("returns an empty list when there is no session", async () => {
    getSessionMock.mockResolvedValue({});

    const result = await getConnectedCompanies();

    expect(result).toEqual({ companies: [], activeCompanyId: undefined });
  });

  it("reads a legacy top-level session without mutating cookies during rendering", async () => {
    const session: Record<string, unknown> = {
      companyId: "999",
      accessToken: "token-999",
      refreshToken: "refresh-999",
      expiresAt: 111,
      save: vi.fn().mockResolvedValue(undefined),
    };
    getSessionMock.mockResolvedValue(session);

    const result = await getConnectedCompanies();

    expect(result).toEqual({
      companies: [{ companyId: "999", companyName: "事業所 999" }],
      activeCompanyId: "999",
    });
    expect(session.companies).toBeUndefined();
    expect(session.save).not.toHaveBeenCalled();
  });
});
