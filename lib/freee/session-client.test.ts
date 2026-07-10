import { afterEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const refreshAccessTokenMock = vi.fn();

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

import { getValidFreeeAuth } from "./session-client";

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
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(auth).toEqual({ accessToken: "new-token", companyId: "999" });
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
});
