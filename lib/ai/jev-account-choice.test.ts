import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountItem } from "@/lib/freee/accounting";
import { accountItemChoiceKey } from "./account-item-buckets";
import {
  classifyAccountItemWithJev,
  formatJevMatcherReasoning,
  tryClassifyAccountItemWithJev,
  type JevChooseFn,
} from "./jev-account-choice";

const input = {
  description: "JR東日本 モバイルSuica",
  amount: -620,
  entrySide: "expense" as const,
  walletableName: "freeeカード Unlimited",
};

function item(id: number, name: string): AccountItem {
  return { id, name, defaultTaxCode: 136 };
}

function scriptedChoose(
  steps: Array<{ questionId: string; choice: string; confidence: number }>,
): JevChooseFn {
  const remaining = [...steps];
  return async (request) => {
    expect(Object.keys(request.criteria).length).toBeLessThan(255);
    const step = remaining.shift();
    if (!step) {
      throw new Error(`unexpected extra JEV call: ${request.questionId}`);
    }
    expect(request.questionId).toBe(step.questionId);
    return {
      choice: step.choice,
      confidence: step.confidence,
      probabilities: { [step.choice]: step.confidence },
    };
  };
}

describe("classifyAccountItemWithJev", () => {
  const accountItems = [
    item(1, "通信費"),
    item(2, "旅費交通費"),
    item(3, "会議費"),
    item(4, "雑費"),
  ];

  it("runs two-stage Choice and returns the selected account item", async () => {
    const choose = scriptedChoose([
      { questionId: "account_bucket", choice: "travel", confidence: 0.88 },
      {
        questionId: "account_item",
        choice: accountItemChoiceKey(accountItems[1]!),
        confidence: 0.91,
      },
    ]);
    const extraTravel = [...accountItems, item(5, "通勤費")];
    const result = await classifyAccountItemWithJev(input, extraTravel, {
      choose,
      minConfidence: 0.6,
    });

    expect(result).toEqual({
      accountItemName: "旅費交通費",
      bucketKey: "travel",
      bucketLabel: "旅費交通費",
      l1Confidence: 0.88,
      l2Confidence: 0.91,
    });
    expect(formatJevMatcherReasoning(result!)).toContain("旅費交通費");
  });

  it("falls through when L1 confidence is below the gate and skips L2", async () => {
    const choose = vi.fn(
      scriptedChoose([
        { questionId: "account_bucket", choice: "travel", confidence: 0.2 },
      ]),
    );
    const result = await classifyAccountItemWithJev(input, accountItems, {
      choose,
      minConfidence: 0.6,
    });
    expect(result).toBeNull();
    expect(choose).toHaveBeenCalledTimes(1);
  });

  it("falls through when L2 confidence is below the gate", async () => {
    const extraTravel = [...accountItems, item(5, "通勤費")];
    const result = await classifyAccountItemWithJev(input, extraTravel, {
      choose: scriptedChoose([
        { questionId: "account_bucket", choice: "travel", confidence: 0.9 },
        {
          questionId: "account_item",
          choice: accountItemChoiceKey(extraTravel[1]!),
          confidence: 0.1,
        },
      ]),
      minConfidence: 0.6,
    });
    expect(result).toBeNull();
  });

  it("skips L1 when only one bucket exists", async () => {
    const choose = scriptedChoose([
      {
        questionId: "account_item",
        choice: "item_10",
        confidence: 0.8,
      },
    ]);
    const result = await classifyAccountItemWithJev(input, [
      item(10, "通信費"),
      item(11, "電話加入権"),
    ], {
      choose,
      minConfidence: 0.6,
    });
    expect(result?.accountItemName).toBe("通信費");
    expect(result?.l1Confidence).toBe(1);
  });

  it("skips L2 when the chosen bucket has a single account item", async () => {
    const choose = scriptedChoose([
      { questionId: "account_bucket", choice: "travel", confidence: 0.95 },
    ]);
    const result = await classifyAccountItemWithJev(input, accountItems, {
      choose,
      minConfidence: 0.6,
    });
    expect(result).toEqual({
      accountItemName: "旅費交通費",
      bucketKey: "travel",
      bucketLabel: "旅費交通費",
      l1Confidence: 0.95,
      l2Confidence: 1,
    });
  });

  it("returns null for an unknown L1 choice", async () => {
    const result = await classifyAccountItemWithJev(input, accountItems, {
      choose: scriptedChoose([
        { questionId: "account_bucket", choice: "not_a_bucket", confidence: 0.99 },
      ]),
      minConfidence: 0.6,
    });
    expect(result).toBeNull();
  });
});

describe("tryClassifyAccountItemWithJev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null when the feature flag is off", async () => {
    vi.stubEnv("JEV_ENABLED", "");
    vi.stubEnv("JEV_API_KEY", "");
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("E2E_TEST_MODE", "");
    await expect(
      tryClassifyAccountItemWithJev(input, [item(1, "通信費")]),
    ).resolves.toBeNull();
  });

  it("swallows JEV errors so Gemini can take over", async () => {
    vi.stubEnv("JEV_ENABLED", "1");
    vi.stubEnv("JEV_API_KEY", "test-key");
    vi.stubEnv("E2E_TEST_MODE", "");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      tryClassifyAccountItemWithJev(input, [
        item(1, "通信費"),
        item(2, "旅費交通費"),
      ]),
    ).resolves.toBeNull();
  });
});
