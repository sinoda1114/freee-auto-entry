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
  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://mykeiri.shinodev.com";
    process.env.FREEE_REDIRECT_URI =
      "https://other.example/api/auth/callback/freee";
    expect(getCanonicalSiteOrigin()).toBe("https://mykeiri.shinodev.com");
  });

  it("falls back to FREEE_REDIRECT_URI origin", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.FREEE_REDIRECT_URI =
      "https://mykeiri.shinodev.com/api/auth/callback/freee";
    expect(getCanonicalSiteOrigin()).toBe("https://mykeiri.shinodev.com");
  });
});

describe("canonicalRedirectUrl", () => {
  it("returns null when host already matches", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://mykeiri.shinodev.com";
    expect(
      canonicalRedirectUrl(
        new URL("https://mykeiri.shinodev.com/api/auth/login?returnTo=%2F"),
      ),
    ).toBeNull();
  });

  it("redirects vercel.app login to the custom domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://mykeiri.shinodev.com";
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
});
