import { describe, expect, it } from "vitest";
import {
  buildRuleDraftsFromPreview,
  buildWalletBatchPreview,
  dedupeRuleDrafts,
} from "./wallet-batch";
import type { UserMatcher, WalletTransaction } from "./wallet";

const transaction: WalletTransaction = {
  id: 1,
  companyId: "11122591",
  date: "2026-07-10",
  amount: -260,
  dueAmount: -260,
  entrySide: "expense",
  walletableType: "credit_card",
  walletableId: 20,
  description: "Microsoft 365",
  status: 1,
  ruleMatched: false,
};

const autoMatcher: UserMatcher = {
  id: 9,
  entrySide: "expense",
  description: "Microsoft 365",
  condition: 3,
  priority: 1,
  act: 1,
  accountItemName: "通信費",
  taxName: "課対仕入10%",
  active: true,
};

const inferenceMatcher: UserMatcher = {
  id: 10,
  entrySide: "expense",
  description: "Microsoft",
  condition: 0,
  priority: 2,
  act: 0,
  accountItemName: "消耗品費",
  taxName: "課対仕入10%",
  active: true,
};

describe("buildWalletBatchPreview", () => {
  it("marks transactions with act=1 rules as rule_matched", () => {
    const preview = buildWalletBatchPreview(
      [transaction],
      [autoMatcher],
      [autoMatcher, inferenceMatcher],
      { "20": "法人カード" },
      [],
      [],
    );

    expect(preview[0]?.category).toBe("rule_matched");
    expect(preview[0]?.matchReason).toContain("Microsoft 365");
  });

  it("falls back to suggestions when no act=1 rule matches", () => {
    const preview = buildWalletBatchPreview(
      [transaction],
      [],
      [inferenceMatcher],
      { "20": "法人カード" },
      [],
      [],
    );

    expect(preview[0]?.category).toBe("suggested");
    expect(preview[0]?.suggestion?.accountItemName).toBe("消耗品費");
  });

  it("dedupes identical rule drafts", () => {
    const preview = buildWalletBatchPreview(
      [
        transaction,
        { ...transaction, id: 2, description: "Microsoft 365" },
      ],
      [],
      [inferenceMatcher],
      { "20": "法人カード" },
      [],
      [],
    );
    const drafts = dedupeRuleDrafts(buildRuleDraftsFromPreview(preview));

    expect(drafts).toHaveLength(1);
  });
});
