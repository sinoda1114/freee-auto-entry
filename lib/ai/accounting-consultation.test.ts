import { describe, expect, it } from "vitest";
import {
  buildAccountingConsultationPrompt,
  validateConsultationReport,
} from "./accounting-consultation";

describe("accounting consultation", () => {
  it("builds an investigation prompt with related records", () => {
    const prompt = buildAccountingConsultationPrompt({
      question: "なぜ現金になっている？",
      target: { kind: "transfer", id: 3137219490 },
      context: {
        targetLabel: "口座振替 #3137219490",
        investigationWindow: {
          startDate: "2025-07-29",
          endDate: "2025-08-12",
        },
        primaryRecord:
          "口座振替 #3137219490 / 日付 2025-08-05 / 金額 5000円",
        relatedRecords: ["明細 #999 / 2025-08-06 / 出金 -5000円"],
        walletableDirectory: ["freeeカード Unlimited (id=20)"],
      },
    });

    expect(prompt).toContain("なぜ現金になっている？");
    expect(prompt).toContain("口座振替 #3137219490");
    expect(prompt).toContain("read-only");
  });

  it("validates structured consultation reports", () => {
    expect(
      validateConsultationReport({
        summary: "カード明細が振替として登録されています。",
        facts: ["振替先が現金です。"],
        hypotheses: [
          {
            title: "消込時の操作ミス",
            likelihood: "high",
            reasoning: "カード明細を振替で処理した可能性があります。",
          },
        ],
        checkpoints: ["現金口座の入金履歴を確認"],
        suggestions: ["支出として再登録を検討"],
      }),
    ).toEqual({
      summary: "カード明細が振替として登録されています。",
      facts: ["振替先が現金です。"],
      hypotheses: [
        {
          title: "消込時の操作ミス",
          likelihood: "high",
          reasoning: "カード明細を振替で処理した可能性があります。",
        },
      ],
      checkpoints: ["現金口座の入金履歴を確認"],
      suggestions: ["支出として再登録を検討"],
    });
  });
});
