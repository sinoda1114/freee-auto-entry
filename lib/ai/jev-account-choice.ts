import {
  resolveTaxNameForAccountItem,
  type AccountItem,
  type TaxCode,
} from "@/lib/freee/accounting";
import type { EntrySide } from "@/lib/freee/wallet";
import {
  accountItemChoiceKey,
  buildAccountItemBuckets,
  isWithinJevChoiceLimit,
  type AccountItemBucket,
} from "./account-item-buckets";
import {
  runJevChoice,
  type JevChoiceAnswer,
  type JevChoiceRequest,
} from "./jev-client";
import { isJevConfidenceHigh, isJevEnabled } from "./jev-config";

export type JevChooseFn = (
  request: JevChoiceRequest,
) => Promise<JevChoiceAnswer>;

export interface JevAccountChoiceInput {
  description: string;
  amount: number;
  entrySide: EntrySide;
  walletableName: string;
}

export interface JevAccountClassification {
  accountItemName: string;
  bucketKey: string;
  bucketLabel: string;
  l1Confidence: number;
  l2Confidence: number;
}

export interface JevMatcherSuggestionFields {
  accountItemName: string;
  taxName: string;
  condition: 0;
  reasoning: string;
}

const SKIPPED_STAGE_CONFIDENCE = 1;

export function buildJevClassificationState(
  input: JevAccountChoiceInput,
): string {
  const sideLabel = input.entrySide === "income" ? "入金" : "出金";
  return [
    `摘要: ${input.description}`,
    `金額: ${Math.abs(input.amount)}円`,
    `収支: ${sideLabel}`,
    `口座: ${input.walletableName}`,
  ].join("\n");
}

export function formatJevMatcherReasoning(
  result: JevAccountClassification,
): string {
  return `摘要から「${result.bucketLabel}」の「${result.accountItemName}」を選びました。`;
}

export function matcherSuggestionFromJev(
  classification: JevAccountClassification,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): JevMatcherSuggestionFields | null {
  const taxName = resolveTaxNameForAccountItem(
    classification.accountItemName,
    accountItems,
    taxCodes,
  );
  if (!taxName) {
    return null;
  }
  return {
    accountItemName: classification.accountItemName,
    taxName,
    condition: 0,
    reasoning: formatJevMatcherReasoning(classification),
  };
}

function bucketCriteria(buckets: AccountItemBucket[]): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const bucket of buckets) {
    const examples = bucket.items
      .slice(0, 8)
      .map((item) => item.name)
      .join("、");
    criteria[bucket.key] = examples
      ? `${bucket.label}。例: ${examples}`
      : bucket.label;
  }
  return criteria;
}

function itemCriteria(items: AccountItem[]): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const item of items) {
    criteria[accountItemChoiceKey(item)] = item.name;
  }
  return criteria;
}

function findBucket(
  buckets: AccountItemBucket[],
  key: string,
): AccountItemBucket | undefined {
  return buckets.find((bucket) => bucket.key === key);
}

function findItemByChoiceKey(
  items: AccountItem[],
  choiceKey: string,
): AccountItem | undefined {
  return items.find((item) => accountItemChoiceKey(item) === choiceKey);
}

async function chooseAmong<T>(
  candidates: T[],
  params: {
    choose: JevChooseFn;
    request: JevChoiceRequest;
    find: (choice: string) => T | undefined;
    minConfidence?: number;
  },
): Promise<{ selected: T; confidence: number } | null> {
  if (!isWithinJevChoiceLimit(candidates.length)) {
    return null;
  }
  const only = candidates[0];
  if (candidates.length === 1 && only) {
    return { selected: only, confidence: SKIPPED_STAGE_CONFIDENCE };
  }

  const answer = await params.choose(params.request);
  if (!isJevConfidenceHigh(answer.confidence, params.minConfidence)) {
    return null;
  }
  const matched = params.find(answer.choice);
  if (!matched) {
    return null;
  }
  return { selected: matched, confidence: answer.confidence };
}

export async function classifyAccountItemWithJev(
  input: JevAccountChoiceInput,
  accountItems: AccountItem[],
  options: {
    choose: JevChooseFn;
    minConfidence?: number;
  },
): Promise<JevAccountClassification | null> {
  const buckets = buildAccountItemBuckets(accountItems);
  const state = buildJevClassificationState(input);

  const l1 = await chooseAmong(buckets, {
    choose: options.choose,
    minConfidence: options.minConfidence,
    request: {
      state,
      questionId: "account_bucket",
      instructions:
        "この取引に最も合う勘定科目の大分類を1つ選んでください。",
      criteria: bucketCriteria(buckets),
    },
    find: (choice) => findBucket(buckets, choice),
  });
  if (!l1) {
    return null;
  }

  const l2 = await chooseAmong(l1.selected.items, {
    choose: options.choose,
    minConfidence: options.minConfidence,
    request: {
      state,
      questionId: "account_item",
      instructions: `大分類「${l1.selected.label}」の中で、この取引に最も合う勘定科目を1つ選んでください。`,
      criteria: itemCriteria(l1.selected.items),
    },
    find: (choice) => findItemByChoiceKey(l1.selected.items, choice),
  });
  if (!l2) {
    return null;
  }

  return {
    accountItemName: l2.selected.name,
    bucketKey: l1.selected.key,
    bucketLabel: l1.selected.label,
    l1Confidence: l1.confidence,
    l2Confidence: l2.confidence,
  };
}

export async function tryClassifyAccountItemWithJev(
  input: JevAccountChoiceInput,
  accountItems: AccountItem[],
): Promise<JevAccountClassification | null> {
  if (!isJevEnabled()) {
    return null;
  }
  try {
    return await classifyAccountItemWithJev(input, accountItems, {
      choose: runJevChoice,
    });
  } catch (error) {
    console.error("JEV account classification failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
