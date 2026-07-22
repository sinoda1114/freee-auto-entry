import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import { isE2ETestMode } from "@/lib/e2e/fixtures";
import { generateGeminiJsonWithImage } from "./gemini";

export interface OcrResult {
  issueDate: string | null;
  amount: number | null;
  description: string | null;
  accountItemName: string | null;
  taxName: string | null;
}

interface RawOcrResponse {
  issueDate?: unknown;
  amount?: unknown;
  description?: unknown;
  accountItemName?: unknown;
  taxName?: unknown;
}

const OCR_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    issueDate: {
      type: "string",
      description:
        "Receipt date in yyyy-mm-dd format, or empty string if not found.",
    },
    amount: {
      type: "integer",
      description:
        "Total amount paid in JPY as a positive integer, or 0 if not found.",
    },
    description: {
      type: "string",
      description:
        "Short description of the purchase (≤40 chars, Japanese preferred), or empty string if unclear.",
    },
    accountItemName: {
      type: "string",
      description:
        "Best-match account item name from the provided list, or empty string if unclear.",
    },
    taxName: {
      type: "string",
      description:
        "Best-match tax category name from the provided list, or empty string if unclear.",
    },
  },
  required: [
    "issueDate",
    "amount",
    "description",
    "accountItemName",
    "taxName",
  ],
} as const;

function normalizeLabel(value: string): string {
  return value.replace(/[\s　]/g, "").toLowerCase();
}

/** マスタ名への照合。完全一致 → 空白差無視 → 包含（最長一致） */
export function resolveMasterName(
  raw: string | null | undefined,
  names: string[],
): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const exact = names.find((name) => name === trimmed);
  if (exact) {
    return exact;
  }
  const normalized = normalizeLabel(trimmed);
  const byNorm = names.find((name) => normalizeLabel(name) === normalized);
  if (byNorm) {
    return byNorm;
  }
  const candidates = names.filter(
    (name) =>
      normalizeLabel(name).includes(normalized) ||
      normalized.includes(normalizeLabel(name)),
  );
  if (candidates.length === 0) {
    return null;
  }
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

export function buildReceiptOcrPrompt(
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): string {
  const accountItemNames = accountItems.map((item) => item.name).join(", ");
  const taxNames = taxCodes.map((tax) => tax.name).join(", ");
  return [
    "You are a Japanese bookkeeping assistant. Extract key information from this receipt image.",
    "Return JSON only. Use an empty string for any field you cannot determine with confidence.",
    `Account item options (accountItemName must be one of these exactly): ${accountItemNames}`,
    `Tax category options (taxName must be one of these exactly): ${taxNames}`,
    "issueDate: date on the receipt in yyyy-mm-dd format (empty string if not found).",
    "amount: total amount paid in JPY as a positive integer including tax (0 if not found).",
    "description: short description of the purchase ≤40 characters, Japanese preferred (empty string if unclear).",
    "accountItemName: best-match account item from the provided list (empty string if unclear).",
    "taxName: best-match tax category from the provided list (empty string if unclear). Prefer the default tax for the chosen account item when the receipt does not specify.",
  ].join("\n");
}

export function validateOcrResult(
  raw: RawOcrResponse,
  accountItems: AccountItem[],
  taxCodes: TaxCode[] = [],
): OcrResult {
  const issueDate =
    typeof raw.issueDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.issueDate)
      ? raw.issueDate
      : null;

  const amount =
    typeof raw.amount === "number" &&
    Number.isInteger(raw.amount) &&
    raw.amount > 0
      ? raw.amount
      : null;

  const description =
    typeof raw.description === "string" && raw.description.trim().length > 0
      ? raw.description.trim().slice(0, 40)
      : null;

  const accountItemName = resolveMasterName(
    typeof raw.accountItemName === "string" ? raw.accountItemName : null,
    accountItems.map((item) => item.name),
  );

  let taxName = resolveMasterName(
    typeof raw.taxName === "string" ? raw.taxName : null,
    taxCodes.map((tax) => tax.name),
  );

  if (!taxName && accountItemName) {
    const accountItem = accountItems.find(
      (item) => item.name === accountItemName,
    );
    if (accountItem) {
      taxName =
        taxCodes.find((tax) => tax.code === accountItem.defaultTaxCode)
          ?.name ?? null;
    }
  }

  return { issueDate, amount, description, accountItemName, taxName };
}

export async function extractReceiptOcr(
  imageBase64: string,
  mimeType: string,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): Promise<OcrResult> {
  if (isE2ETestMode()) {
    const accountItemName = accountItems[0]?.name ?? null;
    const taxName =
      (accountItemName
        ? taxCodes.find(
            (tax) =>
              tax.code ===
              accountItems.find((item) => item.name === accountItemName)
                ?.defaultTaxCode,
          )?.name
        : null) ??
      taxCodes[0]?.name ??
      null;
    return {
      issueDate: "2026-07-01",
      amount: 1100,
      description: "タクシー利用",
      accountItemName,
      taxName,
    };
  }

  const prompt = buildReceiptOcrPrompt(accountItems, taxCodes);
  const raw = await generateGeminiJsonWithImage<RawOcrResponse>(
    prompt,
    imageBase64,
    mimeType,
    OCR_RESPONSE_SCHEMA,
  );

  return validateOcrResult(raw, accountItems, taxCodes);
}
