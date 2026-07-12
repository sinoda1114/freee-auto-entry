import { describe, expect, it } from "vitest";
import {
  batchLlmRulesToDrafts,
  buildMatcherBatchLlmPrompt,
  validateMatcherBatchLlmRules,
} from "./matcher-batch-llm-suggestion";

const accountItems = [
  { id: 1, name: "通信費", defaultTaxCode: 136 },
  { id: 2, name: "会議費", defaultTaxCode: 136 },
];

const taxCodes = [{ code: 136, name: "課対仕入10%" }];

const transactions = [
  {
    id: 1,
    description: "Microsoft 365",
    amount: -1500,
    entrySide: "expense" as const,
    walletableName: "法人カード",
  },
  {
    id: 2,
    description: "Google Workspace",
    amount: -800,
    entrySide: "expense" as const,
    walletableName: "法人カード",
  },
];

describe("matcher batch llm suggestion", () => {
  it("builds a prompt with all selected transactions", () => {
    const prompt = buildMatcherBatchLlmPrompt(
      transactions,
      accountItems,
      taxCodes,
    );

    expect(prompt).toContain("Microsoft 365");
    expect(prompt).toContain("Google Workspace");
    expect(prompt).toContain("id=1");
    expect(prompt).toContain("id=2");
  });

  it("validates grouped rules against masters and transaction ids", () => {
    const rules = validateMatcherBatchLlmRules(
      {
        rules: [
          {
            description: "Microsoft",
            condition: 0,
            accountItemName: "通信費",
            taxName: "課対仕入10%",
            entrySide: "expense",
            reasoning: "サブスク系",
            transactionIds: [1, 2],
          },
        ],
      },
      transactions,
      accountItems,
      taxCodes,
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.transactionIds).toEqual([1, 2]);
  });

  it("converts validated rules into matcher drafts", () => {
    const drafts = batchLlmRulesToDrafts([
      {
        description: "Microsoft",
        condition: 0,
        accountItemName: "通信費",
        taxName: "課対仕入10%",
        entrySide: "expense",
        reasoning: "test",
        transactionIds: [1, 2],
      },
    ]);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.description).toBe("Microsoft");
  });
});
