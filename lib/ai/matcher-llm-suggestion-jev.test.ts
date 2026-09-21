import { afterEach, describe, expect, it, vi } from "vitest";
import { generateGeminiJson } from "./gemini";
import { tryClassifyAccountItemWithJev } from "./jev-account-choice";
import { suggestMatcherFieldsWithLlm } from "./matcher-llm-suggestion";
import { suggestBatchMatcherRulesWithLlm } from "./matcher-batch-llm-suggestion";

vi.mock("./gemini", () => ({
  generateGeminiJson: vi.fn(),
}));

vi.mock("./jev-account-choice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./jev-account-choice")>();
  return {
    ...actual,
    tryClassifyAccountItemWithJev: vi.fn(),
  };
});

const accountItems = [
  { id: 1, name: "通信費", defaultTaxCode: 136 },
  { id: 2, name: "会議費", defaultTaxCode: 136 },
];

const taxCodes = [{ code: 136, name: "課対仕入10%" }];

const input = {
  description: "DAZN Waalsforceクレジットカード",
  amount: -980,
  entrySide: "expense" as const,
  walletableName: "freeeカード Unlimited",
};

const geminiCandidate = {
  accountItemName: "会議費",
  taxName: "課対仕入10%",
  condition: 0,
  reasoning: "Gemini の候補",
};

describe("suggestMatcherFieldsWithLlm JEV gate", () => {
  afterEach(() => {
    vi.mocked(tryClassifyAccountItemWithJev).mockReset();
    vi.mocked(generateGeminiJson).mockReset();
  });

  it("returns a JEV hit without calling Gemini", async () => {
    vi.mocked(tryClassifyAccountItemWithJev).mockResolvedValue({
      accountItemName: "通信費",
      bucketKey: "comms",
      bucketLabel: "通信費",
      l1Confidence: 0.9,
      l2Confidence: 0.88,
    });

    const result = await suggestMatcherFieldsWithLlm(
      input,
      accountItems,
      taxCodes,
    );

    expect(result).toEqual([
      {
        accountItemName: "通信費",
        taxName: "課対仕入10%",
        condition: 0,
        reasoning: "摘要から「通信費」の「通信費」を選びました。",
      },
    ]);
    expect(generateGeminiJson).not.toHaveBeenCalled();
  });

  it("falls back to Gemini when JEV confidence is too low", async () => {
    vi.mocked(tryClassifyAccountItemWithJev).mockResolvedValue(null);
    vi.mocked(generateGeminiJson).mockResolvedValue({
      candidates: [geminiCandidate],
    });

    const result = await suggestMatcherFieldsWithLlm(
      input,
      accountItems,
      taxCodes,
    );

    expect(result).toEqual([geminiCandidate]);
    expect(generateGeminiJson).toHaveBeenCalledTimes(1);
  });
});

describe("suggestBatchMatcherRulesWithLlm JEV gate", () => {
  afterEach(() => {
    vi.mocked(tryClassifyAccountItemWithJev).mockReset();
    vi.mocked(generateGeminiJson).mockReset();
  });

  const dazn = {
    id: 1,
    description: "DAZN",
    amount: -980,
    entrySide: "expense" as const,
    walletableName: "法人カード",
  };
  const lunch = {
    id: 2,
    description: "会議ランチ",
    amount: -3200,
    entrySide: "expense" as const,
    walletableName: "法人カード",
  };

  it("keeps high-confidence JEV rules and sends the rest to Gemini", async () => {
    vi.mocked(tryClassifyAccountItemWithJev).mockImplementation(
      async (transaction) => {
        if (transaction.description === "DAZN") {
          return {
            accountItemName: "通信費",
            bucketKey: "comms",
            bucketLabel: "通信費",
            l1Confidence: 0.9,
            l2Confidence: 0.9,
          };
        }
        return null;
      },
    );
    vi.mocked(generateGeminiJson).mockResolvedValue({
      rules: [
        {
          description: "会議ランチ",
          condition: 0,
          accountItemName: "会議費",
          taxName: "課対仕入10%",
          entrySide: "expense",
          reasoning: "食事を伴う打ち合わせ",
          transactionIds: [2],
        },
      ],
    });

    const rules = await suggestBatchMatcherRulesWithLlm(
      [dazn, lunch],
      accountItems,
      taxCodes,
    );

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      accountItemName: "通信費",
      transactionIds: [1],
    });
    expect(rules[1]).toMatchObject({
      accountItemName: "会議費",
      transactionIds: [2],
    });
    expect(generateGeminiJson).toHaveBeenCalledTimes(1);
    const prompt = String(vi.mocked(generateGeminiJson).mock.calls[0]?.[0]);
    expect(prompt).toContain("会議ランチ");
    expect(prompt).not.toContain("DAZN");
    expect(prompt).toContain("up to 9");
    const schema = vi.mocked(generateGeminiJson).mock.calls[0]?.[1] as {
      properties?: { rules?: { maxItems?: number } };
    };
    expect(schema.properties?.rules?.maxItems).toBe(9);
  });

  it("returns JEV-only rules when Gemini fails after a partial hit", async () => {
    vi.mocked(tryClassifyAccountItemWithJev).mockImplementation(
      async (transaction) => {
        if (transaction.description === "DAZN") {
          return {
            accountItemName: "通信費",
            bucketKey: "comms",
            bucketLabel: "通信費",
            l1Confidence: 0.9,
            l2Confidence: 0.9,
          };
        }
        return null;
      },
    );
    vi.mocked(generateGeminiJson).mockRejectedValue(new Error("Gemini down"));

    const rules = await suggestBatchMatcherRulesWithLlm(
      [dazn, lunch],
      accountItems,
      taxCodes,
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.accountItemName).toBe("通信費");
  });
});
