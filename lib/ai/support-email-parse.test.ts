import { describe, expect, it } from "vitest";
import {
  fallbackParsedSupportEmail,
  validateParsedSupportEmail,
} from "./support-email-parse";
import { buildSupportSimilarityPrompt } from "./support-similarity";
import type { SupportThread } from "@/lib/db/support-threads";

describe("support-email-parse", () => {
  it("validates structured parse results", () => {
    expect(
      validateParsedSupportEmail(
        {
          subject: "振替の件",
          category: "accounting",
          status: "resolved",
          questionSummary: "なぜ現金になったか",
          answerSummary: "消込操作",
          background: "カード利用",
          conclusion: "支出で再登録",
          tags: ["#クレカ", "振替"],
        },
        { kind: "transfer", id: 1 },
      ),
    ).toEqual({
      subject: "振替の件",
      category: "accounting",
      status: "resolved",
      questionSummary: "なぜ現金になったか",
      answerSummary: "消込操作",
      background: "カード利用",
      conclusion: "支出で再登録",
      tags: ["クレカ", "振替"],
      freeeTarget: { kind: "transfer", id: 1 },
    });
  });

  it("builds a fallback from the first email line", () => {
    const parsed = fallbackParsedSupportEmail(
      "カード明細が消えない\n続き...",
      { kind: "wallet_txn", id: 99 },
    );
    expect(parsed.subject).toBe("カード明細が消えない");
    expect(parsed.category).toBe("accounting");
    expect(parsed.freeeTarget).toEqual({ kind: "wallet_txn", id: 99 });
  });

  it("accepts freee service categories beyond accounting", () => {
    const parsed = validateParsedSupportEmail(
      {
        subject: "勤怠締めの件",
        category: "hr",
        status: "open",
        questionSummary: "月次勤怠を締められない",
        answerSummary: "",
        background: "",
        conclusion: "",
        tags: ["勤怠"],
      },
      null,
    );

    expect(parsed?.category).toBe("hr");
  });
});

describe("support-similarity", () => {
  it("builds a prompt with candidate summaries", () => {
    const candidates: SupportThread[] = [
      {
        id: "t1",
        companyId: "1",
        subject: "古い問い合わせ",
        category: "accounting",
        status: "resolved",
        questionSummary: "現金になった",
        answerSummary: "振替操作",
        background: "",
        conclusion: "",
        rawEmail: "raw",
        sourceUrl: null,
        tags: ["振替"],
        freeeTargetKind: null,
        freeeTargetId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const prompt = buildSupportSimilarityPrompt({
      query: "また現金になっている",
      candidates,
    });
    expect(prompt).toContain("また現金になっている");
    expect(prompt).toContain("id=t1");
    expect(prompt).toContain("古い問い合わせ");
  });
});
