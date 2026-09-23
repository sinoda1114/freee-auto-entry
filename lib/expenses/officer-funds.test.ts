import { describe, expect, it } from "vitest";
import { resolveOfficerFundsPayment } from "./officer-funds";

const items = [
  { id: 1, name: "旅費交通費", defaultTaxCode: 136 },
  { id: 88, name: " 役員借入金 ", defaultTaxCode: 0 },
];

describe("resolveOfficerFundsPayment", () => {
  it("builds a private-account payment for the full amount", () => {
    expect(resolveOfficerFundsPayment(items, "2026-09-18", 14280)).toEqual({
      ok: true,
      payment: {
        date: "2026-09-18",
        amount: 14280,
        fromWalletableType: "private_account_item",
        fromWalletableId: 88,
      },
    });
  });

  it("stops when the officer borrowing account is missing", () => {
    const result = resolveOfficerFundsPayment(
      [{ id: 1, name: "旅費交通費", defaultTaxCode: 136 }],
      "2026-09-18",
      1000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("役員借入金");
    }
  });
});
