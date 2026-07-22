import { describe, expect, it, vi } from "vitest";
import {
  buildReceiptOcrPrompt,
  extractReceiptOcr,
  resolveMasterName,
  validateOcrResult,
} from "./receipt-ocr";

const accountItems = [
  { id: 1, name: "旅費交通費", defaultTaxCode: 136 },
  { id: 2, name: "会議費", defaultTaxCode: 136 },
  { id: 3, name: "通信費", defaultTaxCode: 136 },
];

const taxCodes = [
  { code: 136, name: "課対仕入10%" },
  { code: 21, name: "対象外" },
];

describe("buildReceiptOcrPrompt", () => {
  it("プロンプトに勘定科目名と税区分名が含まれる", () => {
    const prompt = buildReceiptOcrPrompt(accountItems, taxCodes);
    expect(prompt).toContain("旅費交通費");
    expect(prompt).toContain("会議費");
    expect(prompt).toContain("課対仕入10%");
    expect(prompt).toContain("taxName");
  });

  it("JSON形式で返すよう指示する", () => {
    const prompt = buildReceiptOcrPrompt(accountItems, taxCodes);
    expect(prompt).toContain("JSON");
  });
});

describe("resolveMasterName", () => {
  it("完全一致・空白差・包含を解決する", () => {
    expect(resolveMasterName("会議費", ["会議費", "旅費交通費"])).toBe("会議費");
    expect(resolveMasterName("会議 費", ["会議費"])).toBe("会議費");
    expect(resolveMasterName("社内会議費", ["会議費", "福利厚生費"])).toBe(
      "会議費",
    );
    expect(resolveMasterName("存在しない", ["会議費"])).toBeNull();
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
        taxName: "課対仕入10%",
      },
      accountItems,
      taxCodes,
    );
    expect(result).toEqual({
      issueDate: "2026-07-01",
      amount: 1100,
      description: "タクシー利用",
      accountItemName: "旅費交通費",
      taxName: "課対仕入10%",
    });
  });

  it("日付フォーマットが不正な場合は null を返す", () => {
    const result = validateOcrResult(
      {
        issueDate: "2026/07/01",
        amount: 500,
        description: "test",
        accountItemName: "会議費",
      },
      accountItems,
      taxCodes,
    );
    expect(result.issueDate).toBeNull();
  });

  it("金額が 0 以下の場合は null を返す", () => {
    const result = validateOcrResult(
      {
        issueDate: "2026-07-01",
        amount: 0,
        description: "test",
        accountItemName: "会議費",
      },
      accountItems,
      taxCodes,
    );
    expect(result.amount).toBeNull();
  });

  it("金額が非整数の場合は null を返す", () => {
    const result = validateOcrResult(
      {
        issueDate: "2026-07-01",
        amount: 1100.5,
        description: "test",
        accountItemName: "会議費",
      },
      accountItems,
      taxCodes,
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
      taxCodes,
    );
    expect(result.accountItemName).toBeNull();
  });

  it("空白差のある勘定科目名をマスタに合わせる", () => {
    const result = validateOcrResult(
      {
        issueDate: "2026-07-01",
        amount: 1000,
        description: "test",
        accountItemName: "旅費 交通費",
      },
      accountItems,
      taxCodes,
    );
    expect(result.accountItemName).toBe("旅費交通費");
  });

  it("税区分が空でも勘定科目のデフォルト税区分を埋める", () => {
    const result = validateOcrResult(
      {
        issueDate: "2026-07-01",
        amount: 1000,
        description: "test",
        accountItemName: "会議費",
        taxName: "",
      },
      accountItems,
      taxCodes,
    );
    expect(result.taxName).toBe("課対仕入10%");
  });

  it("摘要が 40 文字を超える場合はトリムする", () => {
    const longDesc = "あ".repeat(50);
    const result = validateOcrResult(
      {
        issueDate: "2026-07-01",
        amount: 1000,
        description: longDesc,
        accountItemName: "会議費",
      },
      accountItems,
      taxCodes,
    );
    expect(result.description).toHaveLength(40);
  });

  it("空文字列フィールドは null を返す", () => {
    const result = validateOcrResult(
      {
        issueDate: "",
        amount: 0,
        description: "",
        accountItemName: "",
        taxName: "",
      },
      accountItems,
      taxCodes,
    );
    expect(result).toEqual({
      issueDate: null,
      amount: null,
      description: null,
      accountItemName: null,
      taxName: null,
    });
  });

  it("型が不正なフィールドは null を返す", () => {
    const result = validateOcrResult(
      {
        issueDate: 20260701,
        amount: "1100",
        description: 123,
        accountItemName: true,
        taxName: false,
      },
      accountItems,
      taxCodes,
    );
    expect(result).toEqual({
      issueDate: null,
      amount: null,
      description: null,
      accountItemName: null,
      taxName: null,
    });
  });
});

describe("extractReceiptOcr", () => {
  it("E2E_TEST_MODE=1 の場合はフィクスチャを返す", async () => {
    vi.stubEnv("E2E_TEST_MODE", "1");
    const result = await extractReceiptOcr(
      "base64",
      "image/png",
      accountItems,
      taxCodes,
    );
    expect(result.issueDate).toBe("2026-07-01");
    expect(result.amount).toBe(1100);
    expect(result.description).toBe("タクシー利用");
    expect(result.accountItemName).toBe("旅費交通費");
    expect(result.taxName).toBe("課対仕入10%");
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
                  taxName: "課対仕入10%",
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

    const result = await extractReceiptOcr(
      "base64data",
      "image/jpeg",
      accountItems,
      taxCodes,
    );

    expect(result.issueDate).toBe("2026-06-15");
    expect(result.amount).toBe(3300);
    expect(result.description).toBe("会議用ランチ");
    expect(result.accountItemName).toBe("会議費");
    expect(result.taxName).toBe("課対仕入10%");

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("generativelanguage.googleapis.com");
    const body = JSON.parse(call[1]?.body as string) as {
      contents: [{ parts: unknown[] }];
    };
    const parts = body.contents[0].parts;
    expect(parts[0]).toMatchObject({
      inline_data: { mime_type: "image/jpeg", data: "base64data" },
    });

    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });
});
