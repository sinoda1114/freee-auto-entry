import { describe, expect, it } from "vitest";
import { isSessionAuthenticated, type SessionData } from "./session";

describe("isSessionAuthenticated", () => {
  it("returns false when there is no access token", () => {
    const session: SessionData = {};
    expect(isSessionAuthenticated(session)).toBe(false);
  });

  it("returns false when the access token has expired", () => {
    const session: SessionData = {
      accessToken: "token",
      expiresAt: Date.now() - 1000,
    };
    expect(isSessionAuthenticated(session)).toBe(false);
  });

  it("returns true when the access token is present and not expired", () => {
    const session: SessionData = {
      accessToken: "token",
      expiresAt: Date.now() + 60_000,
    };
    expect(isSessionAuthenticated(session)).toBe(true);
  });
});
