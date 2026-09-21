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
import { runJevChoice, type JevChoiceAnswer } from "./jev-client";
import { isJevConfidenceHigh, isJevEnabled } from "./jev-config";

export type JevChooseFn = (request: {
  state: string;
  questionId: string;
  instructions: string;
  criteria: Record<string, string>;
}) => Promise<JevChoiceAnswer>;

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

export async function classifyAccountItemWithJev(
  input: JevAccountChoiceInput,
  accountItems: AccountItem[],
  options: {
    choose: JevChooseFn;
    minConfidence?: number;
  },
): Promise<JevAccountClassification | null> {
  const buckets = buildAccountItemBuckets(accountItems);
  if (!isWithinJevChoiceLimit(buckets.length)) {
    return null;
  }

  const state = buildJevClassificationState(input);
  const minConfidence = options.minConfidence;

  let selectedBucket = buckets[0];
  let l1Confidence = SKIPPED_STAGE_CONFIDENCE;

  if (buckets.length > 1) {
    const l1 = await options.choose({
      state,
      questionId: "account_bucket",
      instructions:
        "この取引に最も合う勘定科目の大分類を1つ選んでください。",
      criteria: bucketCriteria(buckets),
    });
    if (!isJevConfidenceHigh(l1.confidence, minConfidence)) {
      return null;
    }
    const matched = findBucket(buckets, l1.choice);
    if (!matched) {
      return null;
    }
    selectedBucket = matched;
    l1Confidence = l1.confidence;
  }

  if (!selectedBucket || !isWithinJevChoiceLimit(selectedBucket.items.length)) {
    return null;
  }

  let selectedItem = selectedBucket.items[0];
  let l2Confidence = SKIPPED_STAGE_CONFIDENCE;

  if (selectedBucket.items.length > 1) {
    const l2 = await options.choose({
      state,
      questionId: "account_item",
      instructions: `大分類「${selectedBucket.label}」の中で、この取引に最も合う勘定科目を1つ選んでください。`,
      criteria: itemCriteria(selectedBucket.items),
    });
    if (!isJevConfidenceHigh(l2.confidence, minConfidence)) {
      return null;
    }
    const matched = findItemByChoiceKey(selectedBucket.items, l2.choice);
    if (!matched) {
      return null;
    }
    selectedItem = matched;
    l2Confidence = l2.confidence;
  }

  if (!selectedItem) {
    return null;
  }

  return {
    accountItemName: selectedItem.name,
    bucketKey: selectedBucket.key,
    bucketLabel: selectedBucket.label,
    l1Confidence,
    l2Confidence,
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

export function jevClassificationToTaxName(
  classification: JevAccountClassification,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): string | undefined {
  return resolveTaxNameForAccountItem(
    classification.accountItemName,
    accountItems,
    taxCodes,
  );
}
