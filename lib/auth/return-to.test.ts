import { describe, expect, it } from "vitest";
import { buildLoginHref, sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("allows relative app paths with query", () => {
    expect(sanitizeReturnTo("/expenses/suica?p=abc")).toBe(
      "/expenses/suica?p=abc",
    );
  });

  it("rejects open redirects", () => {
    expect(sanitizeReturnTo("https://evil.example/")).toBeUndefined();
    expect(sanitizeReturnTo("//evil.example")).toBeUndefined();
    expect(sanitizeReturnTo("/\\evil")).toBeUndefined();
  });
});

describe("buildLoginHref", () => {
  it("encodes returnTo", () => {
    expect(buildLoginHref("/expenses/suica?p=a+b")).toBe(
      "/api/auth/login?returnTo=%2Fexpenses%2Fsuica%3Fp%3Da%2Bb",
    );
  });
});
