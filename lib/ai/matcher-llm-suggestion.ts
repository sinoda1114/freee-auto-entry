import {
  resolveTaxNameForAccountItem,
  type AccountItem,
  type TaxCode,
} from "@/lib/freee/accounting";
import type { CreateMatcherCondition, EntrySide } from "@/lib/freee/wallet";
import { generateGeminiJson } from "./gemini";

export const MAX_LLM_CANDIDATES = 3;

export interface MatcherLlmInput {
  description: string;
  amount: number;
  entrySide: EntrySide;
  walletableName: string;
}

export interface MatcherLlmSuggestion {
  accountItemName: string;
  taxName: string;
  condition: CreateMatcherCondition;
  reasoning: string;
}

interface RawMatcherLlmSuggestion {
  accountItemName?: unknown;
  taxName?: unknown;
  condition?: unknown;
  reasoning?: unknown;
}

interface RawMatcherLlmResponse {
  candidates?: unknown;
}

const CANDIDATE_SCHEMA = {
  type: "object",
  properties: {
    accountItemName: {
      type: "string",
      description: "Must be one of the provided account item names.",
    },
    taxName: {
      type: "string",
      description: "Must be one of the provided tax names.",
    },
    condition: {
      type: "integer",
      description:
        "Matcher condition: 3 exact, 0 partial, 1 prefix, 2 suffix.",
    },
    reasoning: {
      type: "string",
      description: "Brief Japanese explanation for the accountant.",
    },
  },
  required: ["accountItemName", "taxName", "condition", "reasoning"],
} as const;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      description:
        "Up to 3 ranked alternatives. First item is the best match.",
      items: CANDIDATE_SCHEMA,
      minItems: 1,
      maxItems: MAX_LLM_CANDIDATES,
    },
  },
  required: ["candidates"],
} as const;

function parseCondition(value: unknown): CreateMatcherCondition | null {
  const condition = Number(value);
  return condition === 0 ||
    condition === 1 ||
    condition === 2 ||
    condition === 3
    ? condition
    : null;
}

function candidateKey(suggestion: MatcherLlmSuggestion): string {
  return suggestion.accountItemName;
}

export function buildMatcherLlmPrompt(
  input: MatcherLlmInput,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): string {
  const accountItemNames = accountItems.map((item) => item.name).join("\n- ");
  const taxNames = taxCodes.map((tax) => tax.name).join("\n- ");
  const sideLabel = input.entrySide === "income" ? "入金" : "出金";

  return [
    "You are a Japanese bookkeeping assistant for freee accounting software.",
    `Return up to ${MAX_LLM_CANDIDATES} ranked account item and tax category alternatives for an automatic wallet transaction rule.`,
    "Return JSON only. accountItemName and taxName must exactly match one of the provided options.",
    "Order candidates from most likely to least likely.",
    "Include a second or third candidate only when there is a plausible alternative classification.",
    "Do not repeat the same accountItemName across candidates.",
    "Prefer conservative, common SME classifications.",
    "For recurring card charges with merchant prefixes, condition 0 (partial match) is often appropriate.",
    "",
    `Description: ${input.description}`,
    `Amount (JPY): ${Math.abs(input.amount)}`,
    `Entry side: ${sideLabel}`,
    `Wallet: ${input.walletableName}`,
    "",
    "Account items:",
    `- ${accountItemNames}`,
    "",
    "Tax names:",
    `- ${taxNames}`,
  ].join("\n");
}

export function validateMatcherLlmSuggestion(
  raw: RawMatcherLlmSuggestion,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): MatcherLlmSuggestion | null {
  if (
    typeof raw.accountItemName !== "string" ||
    typeof raw.taxName !== "string" ||
    typeof raw.reasoning !== "string"
  ) {
    return null;
  }

  const condition = parseCondition(raw.condition);
  if (condition === null) {
    return null;
  }

  const accountItem = accountItems.find(
    (item) => item.name === raw.accountItemName,
  );
  const tax = taxCodes.find((item) => item.name === raw.taxName);
  if (!accountItem || !tax) {
    return null;
  }

  return {
    accountItemName: accountItem.name,
    taxName: tax.name,
    condition,
    reasoning: raw.reasoning.trim(),
  };
}

function alignTaxWithAccountDefault(
  suggestion: MatcherLlmSuggestion,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): MatcherLlmSuggestion {
  const defaultTaxName = resolveTaxNameForAccountItem(
    suggestion.accountItemName,
    accountItems,
    taxCodes,
  );
  if (defaultTaxName && suggestion.taxName !== defaultTaxName) {
    return {
      ...suggestion,
      taxName: defaultTaxName,
      reasoning: `${suggestion.reasoning}（税区分は勘定科目のデフォルトに合わせました）`,
    };
  }

  return suggestion;
}

export function validateMatcherLlmCandidates(
  raw: RawMatcherLlmResponse,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): MatcherLlmSuggestion[] {
  if (!Array.isArray(raw.candidates)) {
    return [];
  }

  const seen = new Set<string>();
  const validated: MatcherLlmSuggestion[] = [];

  for (const candidate of raw.candidates) {
    if (validated.length >= MAX_LLM_CANDIDATES) {
      break;
    }

    const suggestion = validateMatcherLlmSuggestion(
      candidate as RawMatcherLlmSuggestion,
      accountItems,
      taxCodes,
    );
    if (!suggestion) {
      continue;
    }

    const key = candidateKey(suggestion);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    validated.push(
      alignTaxWithAccountDefault(suggestion, accountItems, taxCodes),
    );
  }

  return validated;
}

export async function suggestMatcherFieldsWithLlm(
  input: MatcherLlmInput,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): Promise<MatcherLlmSuggestion[]> {
  const prompt = buildMatcherLlmPrompt(input, accountItems, taxCodes);
  const raw = await generateGeminiJson<RawMatcherLlmResponse>(
    prompt,
    RESPONSE_SCHEMA,
  );
  const candidates = validateMatcherLlmCandidates(
    raw,
    accountItems,
    taxCodes,
  );
  if (candidates.length === 0) {
    throw new Error("AI提案をfreeeのマスタ一覧と照合できませんでした。");
  }

  return candidates;
}
