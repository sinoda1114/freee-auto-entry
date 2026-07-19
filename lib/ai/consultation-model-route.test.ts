import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CONSULTATION_HARD_MODEL,
  matchHardRules,
  matchLiteRules,
  resolveConsultationModel,
} from "./consultation-model-route";

describe("matchHardRules", () => {
  it("flags investigate questions", () => {
    expect(matchHardRules("なぜこの振替が現金？", "")).toBe(
      "rule_investigate",
    );
  });

  it("flags consumption-tax recipe from question or history", () => {
    expect(matchHardRules("一般課税と簡易課税どっちが得？", "")).toBe(
      "rule_tax_recipe",
    );
    expect(matchHardRules("それで比較して", "簡易課税と一般課税の比較")).toBe(
      "rule_tax_recipe",
    );
  });

  it("returns null for present questions", () => {
    expect(matchHardRules("損益計算書を表示して", "")).toBeNull();
  });
});

describe("matchLiteRules", () => {
  it("accepts short present questions", () => {
    expect(matchLiteRules("損益計算書を表示して")).toBe(true);
    expect(matchLiteRules("今期の売上はいくら？")).toBe(true);
  });

  it("rejects investigate or long questions", () => {
    expect(matchLiteRules("なぜ現金になっている？")).toBe(false);
    expect(
      matchLiteRules(
        "今期の損益計算書についてポイントを教えてください。売上と費用の内訳もなるべく詳しく見たいので、科目ごとの金額もあわせて見せてほしいです。",
      ),
    ).toBe(false);
  });
});

describe("resolveConsultationModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes investigate to hard without calling classify", async () => {
    const classify = vi.fn(async () => "simple" as const);
    const result = await resolveConsultationModel({
      question: "おかしい明細を調べて",
      classify,
    });
    expect(result.tier).toBe("hard");
    expect(result.reason).toBe("rule_investigate");
    expect(result.modelId).toBe(DEFAULT_CONSULTATION_HARD_MODEL);
    expect(classify).not.toHaveBeenCalled();
  });

  it("routes short present to lite without calling classify", async () => {
    const classify = vi.fn(async () => "complex" as const);
    const result = await resolveConsultationModel({
      question: "貸借対照表を見せて",
      classify,
    });
    expect(result.tier).toBe("lite");
    expect(result.reason).toBe("rule_present_short");
    expect(classify).not.toHaveBeenCalled();
  });

  it("uses classifier when neither rule matches", async () => {
    const classify = vi.fn(async () => "complex" as const);
    const result = await resolveConsultationModel({
      question: "この処理の会計上の取り扱いを整理したい",
      classify,
    });
    expect(result).toEqual({
      modelId: DEFAULT_CONSULTATION_HARD_MODEL,
      tier: "hard",
      reason: "classifier_complex",
    });
    expect(classify).toHaveBeenCalledOnce();
  });

  it("prefers hard when classifier fails", async () => {
    const result = await resolveConsultationModel({
      question: "この処理の会計上の取り扱いを整理したい",
      classify: async () => {
        throw new Error("offline");
      },
    });
    expect(result.reason).toBe("classifier_failed_prefer_hard");
    expect(result.tier).toBe("hard");
  });

  it("respects GEMINI_MODEL_HARD override", async () => {
    vi.stubEnv("GEMINI_MODEL_HARD", "gemini-custom-hard");
    const result = await resolveConsultationModel({
      question: "この取引の会計処理を整理したい",
      classify: async () => "complex",
    });
    expect(result.modelId).toBe("gemini-custom-hard");
    expect(result.reason).toBe("classifier_complex");
  });
});
