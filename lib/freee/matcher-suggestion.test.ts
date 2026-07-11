import { describe, expect, it } from "vitest";
import type { AccountItem, TaxCode } from "./accounting";
import {
  matcherSuggestionSourceLabel,
  suggestMatcherFields,
} from "./matcher-suggestion";
import type { UserMatcher, WalletTransaction } from "./wallet";

const accountItems: AccountItem[] = [
  { id: 1, name: "通信費", defaultTaxCode: 136 },
  { id: 2, name: "外注費", defaultTaxCode: 136 },
];

const taxCodes: TaxCode[] = [{ code: 136, name: "課対仕入10%" }];

const transaction: WalletTransaction = {
  id: 1,
  companyId: "11122591",
  date: "2026-07-11",
  amount: -980,
  dueAmount: -980,
  entrySide: "expense",
  walletableType: "credit_card",
  walletableId: 20,
  description: "DAZN Waalsforceクレジットカード",
  status: 1,
  ruleMatched: false,
};

function matcher(partial: Partial<UserMatcher> & Pick<UserMatcher, "description">): UserMatcher {
  return {
    id: 1,
    entrySide: "expense",
    condition: 3,
    priority: 1,
    act: 1,
    active: true,
    accountItemName: "通信費",
    taxName: "課対仕入10%",
    ...partial,
  };
}

describe("suggestMatcherFields", () => {
  it("prefers an exact automatic registration rule match", () => {
    const suggestion = suggestMatcherFields(
      transaction,
      [
        matcher({
          id: 1,
          description: "DAZN Waalsforceクレジットカード",
          act: 1,
        }),
      ],
      "freeeカード Unlimited",
      accountItems,
      taxCodes,
    );

    expect(suggestion).toEqual({
      accountItemName: "通信費",
      taxName: "課対仕入10%",
      condition: 3,
      source: "auto_rule",
    });
  });

  it("uses inference rules when no automatic rule matches exactly", () => {
    const suggestion = suggestMatcherFields(
      transaction,
      [
        matcher({
          id: 2,
          description: "DAZN",
          condition: 0,
          act: 0,
        }),
      ],
      "freeeカード Unlimited",
      accountItems,
      taxCodes,
    );

    expect(suggestion?.source).toBe("inference_rule");
    expect(suggestion?.accountItemName).toBe("通信費");
  });

  it("falls back to fuzzy matching across similar rules", () => {
    const suggestion = suggestMatcherFields(
      transaction,
      [
        matcher({
          id: 3,
          description: "VERCEL INC.",
          act: 1,
          accountItemName: "外注費",
        }),
      ],
      "freeeカード Unlimited",
      accountItems,
      taxCodes,
    );

    expect(suggestion).toBeNull();
  });

  it("fills tax from account default when a rule has no tax name", () => {
    const suggestion = suggestMatcherFields(
      transaction,
      [
        matcher({
          id: 4,
          description: "DAZN Waalsforceクレジットカード",
          taxName: undefined,
        }),
      ],
      "freeeカード Unlimited",
      accountItems,
      taxCodes,
    );

    expect(suggestion?.taxName).toBe("課対仕入10%");
  });

  it("labels suggestion sources in Japanese", () => {
    expect(matcherSuggestionSourceLabel("auto_rule")).toBe("自動登録ルール");
    expect(matcherSuggestionSourceLabel("inference_rule")).toBe("freee推測ルール");
    expect(matcherSuggestionSourceLabel("fuzzy_rule")).toBe("類似ルール");
  });
});
