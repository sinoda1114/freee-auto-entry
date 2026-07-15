import { describe, expect, it } from "vitest";
import { normalizeGmailSourceUrl } from "./gmail-source-url";

describe("normalizeGmailSourceUrl", () => {
  it("accepts a Gmail web message URL", () => {
    expect(
      normalizeGmailSourceUrl(
        " https://mail.google.com/mail/u/0/#inbox/18f123456789abcd ",
      ),
    ).toBe("https://mail.google.com/mail/u/0/#inbox/18f123456789abcd");
  });

  it("accepts the Google Workspace Gmail host", () => {
    expect(
      normalizeGmailSourceUrl(
        "https://mail.google.com/a/example.com/mail/u/0/#search/freee/18f123456789abcd",
      ),
    ).toBe(
      "https://mail.google.com/a/example.com/mail/u/0/#search/freee/18f123456789abcd",
    );
  });

  it.each([
    "",
    "http://mail.google.com/mail/u/0/#inbox/123",
    "https://evil.example/mail/u/0/#inbox/123",
    "https://mail.google.com.evil.example/mail/u/0/#inbox/123",
    "https://mail.google.com/",
  ])("rejects a non-Gmail message URL: %s", (value) => {
    expect(normalizeGmailSourceUrl(value)).toBeNull();
  });
});
