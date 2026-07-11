import { describe, expect, it } from "vitest";
import {
  buildMatcherLlmPrompt,
  MAX_LLM_CANDIDATES,
  validateMatcherLlmCandidates,
  validateMatcherLlmSuggestion,
} from "./matcher-llm-suggestion";

const accountItems = [
  { id: 1, name: "通信費", defaultTaxCode: 136 },
  { id: 2, name: "会議費", defaultTaxCode: 136 },
];

const taxCodes = [{ code: 136, name: "課対仕入10%" }];

describe("matcher llm suggestion", () => {
  it("builds a prompt with transaction context and master lists", () => {
    const prompt = buildMatcherLlmPrompt(
      {
        description: "DAZN Waalsforceクレジットカード",
        amount: -980,
        entrySide: "expense",
        walletableName: "freeeカード Unlimited",
      },
      accountItems,
      taxCodes,
    );

    expect(prompt).toContain("DAZN Waalsforceクレジットカード");
    expect(prompt).toContain("通信費");
    expect(prompt).toContain("課対仕入10%");
    expect(prompt).toContain(String(MAX_LLM_CANDIDATES));
  });

  it("accepts only account items and tax names from the provided masters", () => {
    expect(
      validateMatcherLlmSuggestion(
        {
          accountItemName: "通信費",
          taxName: "課対仕入10%",
          condition: 0,
          reasoning: "サブスクリプション料金のため",
        },
        accountItems,
        taxCodes,
      ),
    ).toEqual({
      accountItemName: "通信費",
      taxName: "課対仕入10%",
      condition: 0,
      reasoning: "サブスクリプション料金のため",
    });
  });

  it("rejects values outside the master lists", () => {
    expect(
      validateMatcherLlmSuggestion(
        {
          accountItemName: "存在しない科目",
          taxName: "課対仕入10%",
          condition: 3,
          reasoning: "test",
        },
        accountItems,
        taxCodes,
      ),
    ).toBeNull();
  });

  it("returns ranked candidates and deduplicates by account item", () => {
    expect(
      validateMatcherLlmCandidates(
        {
          candidates: [
            {
              accountItemName: "通信費",
              taxName: "課対仕入10%",
              condition: 0,
              reasoning: "第一候補",
            },
            {
              accountItemName: "通信費",
              taxName: "課対仕入10%",
              condition: 3,
              reasoning: "重複科目",
            },
            {
              accountItemName: "会議費",
              taxName: "課対仕入10%",
              condition: 0,
              reasoning: "第二候補",
            },
          ],
        },
        accountItems,
        taxCodes,
      ),
    ).toEqual([
      {
        accountItemName: "通信費",
        taxName: "課対仕入10%",
        condition: 0,
        reasoning: "第一候補",
      },
      {
        accountItemName: "会議費",
        taxName: "課対仕入10%",
        condition: 0,
        reasoning: "第二候補",
      },
    ]);
  });

  it("caps candidates at the configured maximum", () => {
    const extendedAccountItems = [
      ...accountItems,
      { id: 3, name: "支払手数料", defaultTaxCode: 136 },
    ];

    const candidates = validateMatcherLlmCandidates(
      {
        candidates: [
          {
            accountItemName: "通信費",
            taxName: "課対仕入10%",
            condition: 0,
            reasoning: "1",
          },
          {
            accountItemName: "会議費",
            taxName: "課対仕入10%",
            condition: 0,
            reasoning: "2",
          },
          {
            accountItemName: "支払手数料",
            taxName: "課対仕入10%",
            condition: 0,
            reasoning: "3",
          },
          {
            accountItemName: "通信費",
            taxName: "課対仕入10%",
            condition: 1,
            reasoning: "dup",
          },
        ],
      },
      extendedAccountItems,
      taxCodes,
    );

    expect(candidates).toHaveLength(MAX_LLM_CANDIDATES);
  });
});
