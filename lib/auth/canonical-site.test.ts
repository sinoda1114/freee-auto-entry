import { describe, expect, it, afterEach } from "vitest";
import {
  canonicalRedirectUrl,
  getCanonicalSiteOrigin,
} from "./canonical-site";

const ORIGINAL_SITE = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_REDIRECT = process.env.FREEE_REDIRECT_URI;

afterEach(() => {
  if (ORIGINAL_SITE === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE;
  }
  if (ORIGINAL_REDIRECT === undefined) {
    delete process.env.FREEE_REDIRECT_URI;
  } else {
    process.env.FREEE_REDIRECT_URI = ORIGINAL_REDIRECT;
  }
});

describe("getCanonicalSiteOrigin", () => {
  it("prefers FREEE_REDIRECT_URI over NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://freee-auto-entry.vercel.app";
    process.env.FREEE_REDIRECT_URI =
      "https://mykeiri.shinodev.com/api/auth/callback/freee";
    expect(getCanonicalSiteOrigin()).toBe("https://mykeiri.shinodev.com");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL", () => {
    delete process.env.FREEE_REDIRECT_URI;
    process.env.NEXT_PUBLIC_SITE_URL = "https://mykeiri.shinodev.com";
    expect(getCanonicalSiteOrigin()).toBe("https://mykeiri.shinodev.com");
  });
});

describe("canonicalRedirectUrl", () => {
  it("returns null when host already matches", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.FREEE_REDIRECT_URI =
      "https://mykeiri.shinodev.com/api/auth/callback/freee";
    expect(
      canonicalRedirectUrl(
        new URL("https://mykeiri.shinodev.com/api/auth/login?returnTo=%2F"),
      ),
    ).toBeNull();
  });

  it("redirects vercel.app login to the callback host", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.FREEE_REDIRECT_URI =
      "https://mykeiri.shinodev.com/api/auth/callback/freee";
    expect(
      canonicalRedirectUrl(
        new URL(
          "https://freee-auto-entry.vercel.app/api/auth/login?returnTo=%2Fexpenses%2Fnew",
        ),
      ),
    ).toBe(
      "https://mykeiri.shinodev.com/api/auth/login?returnTo=%2Fexpenses%2Fnew",
    );
  });

  it("rejects protocol-relative pathnames", () => {
    process.env.FREEE_REDIRECT_URI =
      "https://mykeiri.shinodev.com/api/auth/callback/freee";
    const crafted = new URL("https://freee-auto-entry.vercel.app/");
    Object.defineProperty(crafted, "pathname", { value: "//evil.com" });
    expect(canonicalRedirectUrl(crafted)).toBeNull();
  });
});
