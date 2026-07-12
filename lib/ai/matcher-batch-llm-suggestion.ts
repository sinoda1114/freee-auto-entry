import {
  resolveTaxNameForAccountItem,
  type AccountItem,
  type TaxCode,
} from "@/lib/freee/accounting";
import type { CreateMatcherCondition, EntrySide } from "@/lib/freee/wallet";
import { generateGeminiJson } from "./gemini";

export const MAX_BATCH_LLM_RULES = 10;
export const MAX_BATCH_LLM_TRANSACTIONS = 20;

export interface MatcherBatchLlmTransaction {
  id: number;
  description: string;
  amount: number;
  entrySide: EntrySide;
  walletableName: string;
}

export interface MatcherBatchLlmRule {
  description: string;
  condition: CreateMatcherCondition;
  accountItemName: string;
  taxName: string;
  entrySide: EntrySide;
  reasoning: string;
  transactionIds: number[];
}

interface RawBatchRule {
  description?: unknown;
  condition?: unknown;
  accountItemName?: unknown;
  taxName?: unknown;
  entrySide?: unknown;
  reasoning?: unknown;
  transactionIds?: unknown;
}

interface RawBatchResponse {
  rules?: unknown;
}

const RULE_SCHEMA = {
  type: "object",
  properties: {
    description: {
      type: "string",
      description:
        "Rule keyword to match in wallet transaction descriptions (partial match target).",
    },
    condition: {
      type: "integer",
      description: "0 partial, 1 prefix, 2 suffix, 3 exact.",
    },
    accountItemName: {
      type: "string",
      description: "Must match one of the provided account item names.",
    },
    taxName: {
      type: "string",
      description: "Must match one of the provided tax names.",
    },
    entrySide: {
      type: "string",
      description: "income or expense.",
    },
    reasoning: {
      type: "string",
      description: "Brief Japanese explanation.",
    },
    transactionIds: {
      type: "array",
      items: { type: "integer" },
      description: "IDs of transactions covered by this rule.",
    },
  },
  required: [
    "description",
    "condition",
    "accountItemName",
    "taxName",
    "entrySide",
    "reasoning",
    "transactionIds",
  ],
} as const;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    rules: {
      type: "array",
      items: RULE_SCHEMA,
      minItems: 1,
      maxItems: MAX_BATCH_LLM_RULES,
    },
  },
  required: ["rules"],
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

function parseEntrySide(value: unknown): EntrySide | null {
  return value === "income" || value === "expense" ? value : null;
}

export function buildMatcherBatchLlmPrompt(
  transactions: MatcherBatchLlmTransaction[],
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): string {
  const accountItemNames = accountItems.map((item) => item.name).join("\n- ");
  const taxNames = taxCodes.map((tax) => tax.name).join("\n- ");
  const lines = transactions.map((txn) => {
    const side = txn.entrySide === "income" ? "入金" : "出金";
    return `- id=${txn.id} | ${txn.description} | ${Math.abs(txn.amount)}円 | ${side} | ${txn.walletableName}`;
  });

  return [
    "You are a Japanese bookkeeping assistant for freee accounting software.",
    `Propose up to ${MAX_BATCH_LLM_RULES} automatic wallet transaction registration rules for the selected unprocessed transactions.`,
    "Group similar transactions into one rule when appropriate (same merchant pattern, same account item).",
    "Return JSON only. accountItemName and taxName must exactly match provided options.",
    "Each rule must list transactionIds it covers. Every input transaction id must appear in exactly one rule.",
    "Prefer partial match (condition 0) for card merchant prefixes unless exact match is clearly better.",
    "Use conservative SME classifications.",
    "",
    "Transactions:",
    ...lines,
    "",
    "Account items:",
    `- ${accountItemNames}`,
    "",
    "Tax names:",
    `- ${taxNames}`,
  ].join("\n");
}

export function validateMatcherBatchLlmRules(
  raw: RawBatchResponse,
  transactions: MatcherBatchLlmTransaction[],
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): MatcherBatchLlmRule[] {
  if (!Array.isArray(raw.rules)) {
    return [];
  }

  const validIds = new Set(transactions.map((txn) => txn.id));
  const txnById = new Map(transactions.map((txn) => [txn.id, txn]));
  const usedIds = new Set<number>();
  const validated: MatcherBatchLlmRule[] = [];

  for (const rawRule of raw.rules) {
    if (validated.length >= MAX_BATCH_LLM_RULES) {
      break;
    }
    const rule = rawRule as RawBatchRule;
    const condition = parseCondition(rule.condition);
    const entrySide = parseEntrySide(rule.entrySide);
    if (
      typeof rule.description !== "string" ||
      typeof rule.accountItemName !== "string" ||
      typeof rule.taxName !== "string" ||
      typeof rule.reasoning !== "string" ||
      condition === null ||
      !entrySide ||
      !Array.isArray(rule.transactionIds)
    ) {
      continue;
    }

    const accountItem = accountItems.find(
      (item) => item.name === rule.accountItemName,
    );
    const tax = taxCodes.find((item) => item.name === rule.taxName);
    if (!accountItem || !tax) {
      continue;
    }

    const transactionIds = rule.transactionIds.filter(
      (id): id is number =>
        typeof id === "number" &&
        validIds.has(id) &&
        !usedIds.has(id) &&
        txnById.get(id)?.entrySide === entrySide,
    );
    if (transactionIds.length === 0) {
      continue;
    }

    for (const id of transactionIds) {
      usedIds.add(id);
    }

    const defaultTaxName = resolveTaxNameForAccountItem(
      accountItem.name,
      accountItems,
      taxCodes,
    );

    validated.push({
      description: rule.description.trim(),
      condition,
      accountItemName: accountItem.name,
      taxName: defaultTaxName ?? tax.name,
      entrySide,
      reasoning: rule.reasoning.trim(),
      transactionIds,
    });
  }

  return validated;
}

export async function suggestBatchMatcherRulesWithLlm(
  transactions: MatcherBatchLlmTransaction[],
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): Promise<MatcherBatchLlmRule[]> {
  if (transactions.length === 0) {
    throw new Error("提案対象の明細がありません。");
  }
  if (transactions.length > MAX_BATCH_LLM_TRANSACTIONS) {
    throw new Error(
      `AI提案は一度に${MAX_BATCH_LLM_TRANSACTIONS}件までです。`,
    );
  }

  const prompt = buildMatcherBatchLlmPrompt(
    transactions,
    accountItems,
    taxCodes,
  );
  const raw = await generateGeminiJson<RawBatchResponse>(
    prompt,
    RESPONSE_SCHEMA,
  );
  const rules = validateMatcherBatchLlmRules(
    raw,
    transactions,
    accountItems,
    taxCodes,
  );
  if (rules.length === 0) {
    throw new Error("AI提案をfreeeのマスタ一覧と照合できませんでした。");
  }

  return rules;
}

export function batchLlmRulesToDrafts(
  rules: MatcherBatchLlmRule[],
): Array<{
  transactionId: number;
  entrySide: EntrySide;
  description: string;
  condition: CreateMatcherCondition;
  accountItemName: string;
  taxName: string;
}> {
  const drafts: Array<{
    transactionId: number;
    entrySide: EntrySide;
    description: string;
    condition: CreateMatcherCondition;
    accountItemName: string;
    taxName: string;
  }> = [];
  for (const rule of rules) {
    for (const transactionId of rule.transactionIds) {
      drafts.push({
        transactionId,
        entrySide: rule.entrySide,
        description: rule.description,
        condition: rule.condition,
        accountItemName: rule.accountItemName,
        taxName: rule.taxName,
      });
    }
  }
  return drafts;
}
