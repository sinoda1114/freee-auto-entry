import { describe, expect, it } from "vitest";
import { findOfficerFundsWalletable } from "./officer-funds";

describe("findOfficerFundsWalletable", () => {
  it("returns the officer funds account", () => {
    expect(
      findOfficerFundsWalletable([
        { id: 1, name: "普通預金", type: "bank_account" },
        { id: 30, name: " 役員資金 ", type: "wallet" },
      ]),
    ).toEqual({ status: "found", id: 30, type: "wallet" });
  });

  it("reports a missing account and a missing type separately", () => {
    expect(
      findOfficerFundsWalletable([
        { id: 1, name: "法人カード", type: "credit_card" },
      ]),
    ).toEqual({ status: "missing" });
    expect(
      findOfficerFundsWalletable([{ id: 30, name: "役員資金" }]),
    ).toEqual({ status: "untyped" });
  });
});
