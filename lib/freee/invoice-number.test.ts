import { describe, expect, it } from "vitest";
import {
  allocateNextInvoiceNumberPrefix,
  allocateUniqueTraditionalInvoiceNumber,
  generateInvoiceNumber,
  inferInvoiceNumberPrefix,
  invoiceYyMmFromBillingDate,
  invoiceYyMmFromSubjectAndBilling,
  isInvoiceNumberForbiddenError,
  isInvoiceNumberRequiredError,
  parseTraditionalInvoiceNumber,
} from "./invoice-number";
import { FreeeInvoiceApiError } from "./invoice";

describe("parseTraditionalInvoiceNumber", () => {
  it("parses prefix, yymm, and optional branch", () => {
    expect(parseTraditionalInvoiceNumber("0062507")).toEqual({
      prefix: "006",
      yymm: "2507",
      branch: 1,
    });
    expect(parseTraditionalInvoiceNumber("0052601-2")).toEqual({
      prefix: "005",
      yymm: "2601",
      branch: 2,
    });
  });
});

describe("invoiceYyMmFromBillingDate / subject", () => {
  it("builds YYMM from billing date", () => {
    expect(invoiceYyMmFromBillingDate("2026-08-22")).toBe("2608");
  });

  it("prefers 月分 in the subject", () => {
    expect(
      invoiceYyMmFromSubjectAndBilling(
        "博報堂プロダクツ 8月分 開発案件",
        "2026-08-22",
      ),
    ).toBe("2608");
  });
});

describe("inferInvoiceNumberPrefix", () => {
  it("prefers subject-overlapping traditional numbers for the partner", () => {
    expect(
      inferInvoiceNumberPrefix({
        partnerId: 87428281,
        subject: "博報堂プロダクツ 8月分 開発案件",
        hints: [
          {
            partnerId: 87428281,
            subject: "NTTデータグループ 4月分 開発案件",
            invoiceNumber: "0052604",
            billingDate: "2026-04-27",
          },
          {
            partnerId: 87428281,
            subject: "博報堂プロダクツ 7月分 開発案件",
            invoiceNumber: "0062507",
            billingDate: "2026-07-21",
          },
        ],
      }),
    ).toBe("006");
  });
});

describe("allocateNextInvoiceNumberPrefix", () => {
  it("increments the max traditional prefix", () => {
    expect(
      allocateNextInvoiceNumberPrefix(["0052604", "0062507", "INV-1"]),
    ).toBe("007");
  });
});

describe("allocateUniqueTraditionalInvoiceNumber", () => {
  it("adds -2 when the base number already exists", () => {
    expect(
      allocateUniqueTraditionalInvoiceNumber({
        prefix: "006",
        yymm: "2608",
        existingNumbers: ["0062608"],
      }),
    ).toBe("0062608-2");
  });
});

describe("generateInvoiceNumber", () => {
  it("builds a traditional number from inferred prefix and subject month", () => {
    expect(
      generateInvoiceNumber({
        billingDate: "2026-08-22",
        partnerId: 87428281,
        subject: "博報堂プロダクツ 8月分 開発案件",
        hints: [
          {
            partnerId: 87428281,
            subject: "博報堂プロダクツ 7月分 開発案件",
            invoiceNumber: "0062507",
            billingDate: "2026-07-21",
          },
        ],
        existingNumbers: ["0062507"],
      }),
    ).toBe("0062608");
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
