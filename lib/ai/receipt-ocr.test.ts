import { describe, expect, it, vi } from "vitest";
import {
  buildReceiptOcrPrompt,
  extractReceiptOcr,
  validateOcrResult,
} from "./receipt-ocr";

const accountItems = [
  { id: 1, name: "旅費交通費", defaultTaxCode: 136 },
  { id: 2, name: "会議費", defaultTaxCode: 136 },
  { id: 3, name: "通信費", defaultTaxCode: 136 },
];

const taxCodes = [{ code: 136, name: "課対仕入10%" }];

describe("buildReceiptOcrPrompt", () => {
  it("プロンプトに勘定科目名と税区分名が含まれる", () => {
    const prompt = buildReceiptOcrPrompt(accountItems, taxCodes);
    expect(prompt).toContain("旅費交通費");
    expect(prompt).toContain("会議費");
    expect(prompt).toContain("課対仕入10%");
  });

  it("JSON形式で返すよう指示する", () => {
    const prompt = buildReceiptOcrPrompt(accountItems, taxCodes);
    expect(prompt).toContain("JSON");
  });
});

describe("validateOcrResult", () => {
  it("有効なフィールドをすべて返す", () => {
    const result = validateOcrResult(
      {
        issueDate: "2026-07-01",
        amount: 1100,
        description: "タクシー利用",
        accountItemName: "旅費交通費",
      },
      accountItems,
    );
    expect(result).toEqual({
      issueDate: "2026-07-01",
      amount: 1100,
      description: "タクシー利用",
      accountItemName: "旅費交通費",
    });
  });

  it("日付フォーマットが不正な場合は null を返す", () => {
    const result = validateOcrResult(
      { issueDate: "2026/07/01", amount: 500, description: "test", accountItemName: "会議費" },
      accountItems,
    );
    expect(result.issueDate).toBeNull();
  });

  it("金額が 0 以下の場合は null を返す", () => {
    const result = validateOcrResult(
      { issueDate: "2026-07-01", amount: 0, description: "test", accountItemName: "会議費" },
      accountItems,
    );
    expect(result.amount).toBeNull();
  });

  it("金額が非整数の場合は null を返す", () => {
    const result = validateOcrResult(
      { issueDate: "2026-07-01", amount: 1100.5, description: "test", accountItemName: "会議費" },
      accountItems,
    );
    expect(result.amount).toBeNull();
  });

  it("マスタに存在しない勘定科目名は null を返す", () => {
    const result = validateOcrResult(
      {
        issueDate: "2026-07-01",
        amount: 1000,
        description: "test",
        accountItemName: "存在しない科目",
      },
      accountItems,
    );
    expect(result.accountItemName).toBeNull();
  });

  it("摘要が 40 文字を超える場合はトリムする", () => {
    const longDesc = "あ".repeat(50);
    const result = validateOcrResult(
      { issueDate: "2026-07-01", amount: 1000, description: longDesc, accountItemName: "会議費" },
      accountItems,
    );
    expect(result.description).toHaveLength(40);
  });

  it("空文字列フィールドは null を返す", () => {
    const result = validateOcrResult(
      { issueDate: "", amount: 0, description: "", accountItemName: "" },
      accountItems,
    );
    expect(result).toEqual({
      issueDate: null,
      amount: null,
      description: null,
      accountItemName: null,
    });
  });

  it("型が不正なフィールドは null を返す", () => {
    const result = validateOcrResult(
      { issueDate: 20260701, amount: "1100", description: 123, accountItemName: true },
      accountItems,
    );
    expect(result).toEqual({
      issueDate: null,
      amount: null,
      description: null,
      accountItemName: null,
    });
  });
});

describe("extractReceiptOcr", () => {
  it("E2E_TEST_MODE=1 の場合はフィクスチャを返す", async () => {
    vi.stubEnv("E2E_TEST_MODE", "1");
    const result = await extractReceiptOcr("base64", "image/png", accountItems, taxCodes);
    expect(result.issueDate).toBe("2026-07-01");
    expect(result.amount).toBe(1100);
    expect(result.description).toBe("タクシー利用");
    expect(result.accountItemName).toBe("旅費交通費");
    vi.unstubAllEnvs();
  });

  it("E2E_TEST_MODE なしで Gemini を呼び validateOcrResult を適用する", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    vi.stubEnv("GEMINI_API_KEY", "test-key");

    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  issueDate: "2026-06-15",
                  amount: 3300,
                  description: "会議用ランチ",
                  accountItemName: "会議費",
                }),
              },
            ],
          },
        },
      ],
    };

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await extractReceiptOcr("base64data", "image/jpeg", accountItems, taxCodes);

    expect(result.issueDate).toBe("2026-06-15");
    expect(result.amount).toBe(3300);
    expect(result.description).toBe("会議用ランチ");
    expect(result.accountItemName).toBe("会議費");

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("generativelanguage.googleapis.com");
    const body = JSON.parse(call[1]?.body as string) as { contents: [{ parts: unknown[] }] };
    const parts = body.contents[0].parts;
    expect(parts[0]).toMatchObject({ inline_data: { mime_type: "image/jpeg", data: "base64data" } });

    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });
});
