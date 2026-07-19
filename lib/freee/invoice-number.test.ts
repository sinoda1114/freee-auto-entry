import { describe, expect, it } from "vitest";
import {
  generateInvoiceNumber,
  isInvoiceNumberForbiddenError,
  isInvoiceNumberRequiredError,
} from "./invoice-number";
import { FreeeInvoiceApiError } from "./invoice";

describe("generateInvoiceNumber", () => {
  it("builds a stable-looking number from billing date and partner", () => {
    expect(
      generateInvoiceNumber({
        billingDate: "2026-07-19",
        partnerId: 123,
        suffix: "ab12",
      }),
    ).toBe("20260719-123-ab12");
  });
});

describe("isInvoiceNumberRequiredError", () => {
  it("detects freee auto-numbering-disabled errors", () => {
    expect(
      isInvoiceNumberRequiredError(
        new FreeeInvoiceApiError(
          400,
          'freee invoice API request failed: 400 {"messages":["自動採番が無効なので、invoice_number は必須です。"]}',
        ),
      ),
    ).toBe(true);
    expect(
      isInvoiceNumberRequiredError(new Error("partner_id is invalid")),
    ).toBe(false);
  });
});

describe("isInvoiceNumberForbiddenError", () => {
  it("detects freee auto-numbering-enabled errors", () => {
    expect(
      isInvoiceNumberForbiddenError(
        new FreeeInvoiceApiError(
          400,
          'freee invoice API request failed: 400 {"messages":["自動採番するので、invoice_number は指定できません。"]}',
        ),
      ),
    ).toBe(true);
  });
});
