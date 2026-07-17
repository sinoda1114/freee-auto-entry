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
        fiscalYearLabel: null,
        reportSummaries: [],
        ledgerSummary: null,
        dataFreshness: null,
        intentKind: "record",
        responseMode: "investigate",
      },
    });

    expect(prompt).toContain("なぜ現金になっている？");
    expect(prompt).toContain("口座振替 #3137219490");
    expect(prompt).toContain("read-only");
    expect(prompt).toContain("NEVER say you lack permission");
    expect(prompt).toContain("RESPONSE MODE: investigate");
  });

  it("includes P&L report summaries when provided", () => {
    const prompt = buildAccountingConsultationPrompt({
      question: "25年度の損益計算書を見てもらうことは可能ですか？",
      target: null,
      context: {
        targetLabel: null,
        investigationWindow: {
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
        primaryRecord: "レポート参照モード",
        relatedRecords: [],
        walletableDirectory: [],
        fiscalYearLabel: "2025年度（2025-01-01〜2025-12-31）",
        reportSummaries: [
          "損益計算書（2025-01-01〜2025-12-31 / 集計は最新）:\n  - 売上高 / 12,000,000円",
        ],
        ledgerSummary: null,
        dataFreshness: "損益計算書: 集計は最新",
        intentKind: "report_pl",
        responseMode: "present",
      },
    });

    expect(prompt).toContain("損益計算書");
    expect(prompt).toContain("売上高");
    expect(prompt).toContain("you DO have this data");
    expect(prompt).toContain("RESPONSE MODE: present");
    expect(prompt).toContain("MUST be empty arrays");
  });

  it("strips investigation sections in present mode validation", () => {
    expect(
      validateConsultationReport(
        {
          mode: "present",
          summary: "売上は1000円です。",
          facts: ["売上高: 1,000円"],
          hypotheses: [
            {
              title: "不要な仮説",
              likelihood: "high",
              reasoning: "出すべきでない",
            },
          ],
          checkpoints: ["確認不要"],
          suggestions: ["修正不要"],
        },
        "present",
      ),
    ).toEqual({
      mode: "present",
      summary: "売上は1000円です。",
      facts: ["売上高: 1,000円"],
      hypotheses: [],
      checkpoints: [],
      suggestions: [],
    });
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
      mode: "investigate",
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
