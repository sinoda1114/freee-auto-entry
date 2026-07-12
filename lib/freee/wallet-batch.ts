import type { AccountItem, TaxCode } from "./accounting";
import {
  matcherSuggestionSourceLabel,
  suggestMatcherFields,
  type MatcherFieldSuggestion,
} from "./matcher-suggestion";
import {
  matchUserMatcher,
  type UserMatcher,
  type WalletTransaction,
} from "./wallet";

export type WalletBatchCategory =
  | "rule_matched"
  | "suggested"
  | "no_suggestion";

export interface WalletBatchPreviewItem {
  transaction: WalletTransaction;
  walletableName: string;
  category: WalletBatchCategory;
  matchedRule?: UserMatcher;
  suggestion?: MatcherFieldSuggestion;
  matchReason: string;
  ruleDescription: string;
}

export function walletBatchCategoryLabel(
  category: WalletBatchCategory,
): string {
  switch (category) {
    case "rule_matched":
      return "ルール一致";
    case "suggested":
      return "ルール作成可";
    case "no_suggestion":
      return "要手動設定";
  }
}

function ruleDescriptionFor(transaction: WalletTransaction): string {
  return transaction.description.trim();
}

function matchReasonForRule(matcher: UserMatcher): string {
  const conditionLabel =
    matcher.condition === 0
      ? "部分一致"
      : matcher.condition === 1
        ? "前方一致"
        : matcher.condition === 2
          ? "後方一致"
          : matcher.condition === 3
            ? "完全一致"
            : "条件なし";
  return `自動登録ルール「${matcher.description}」（${conditionLabel}）`;
}

export function buildWalletBatchPreview(
  transactions: WalletTransaction[],
  matchers: UserMatcher[],
  suggestionMatchers: UserMatcher[],
  walletableNames: Record<string, string>,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): WalletBatchPreviewItem[] {
  return transactions.map((transaction) => {
    const walletableName =
      walletableNames[String(transaction.walletableId)] ??
      `${transaction.walletableType} #${transaction.walletableId}`;
    const matchedRule = matchUserMatcher(
      transaction,
      matchers,
      walletableName,
    );
    if (matchedRule) {
      return {
        transaction,
        walletableName,
        category: "rule_matched",
        matchedRule,
        matchReason: matchReasonForRule(matchedRule),
        ruleDescription: ruleDescriptionFor(transaction),
      };
    }

    const suggestion = suggestMatcherFields(
      transaction,
      suggestionMatchers,
      walletableName,
      accountItems,
      taxCodes,
    );
    if (suggestion) {
      return {
        transaction,
        walletableName,
        category: "suggested",
        suggestion,
        matchReason: `${matcherSuggestionSourceLabel(suggestion.source)}から提案`,
        ruleDescription: ruleDescriptionFor(transaction),
      };
    }

    return {
      transaction,
      walletableName,
      category: "no_suggestion",
      matchReason: "一致するルールや提案がありません",
      ruleDescription: ruleDescriptionFor(transaction),
    };
  });
}

export interface WalletBatchRuleDraft {
  transactionId: number;
  entrySide: WalletTransaction["entrySide"];
  description: string;
  condition: MatcherFieldSuggestion["condition"];
  accountItemName: string;
  taxName: string;
  walletable?: string;
}

export function buildRuleDraftsFromPreview(
  items: WalletBatchPreviewItem[],
): WalletBatchRuleDraft[] {
  return items
    .filter((item) => item.category === "suggested" && item.suggestion)
    .map((item) => ({
      transactionId: item.transaction.id,
      entrySide: item.transaction.entrySide,
      description: item.ruleDescription,
      condition: item.suggestion!.condition,
      accountItemName: item.suggestion!.accountItemName,
      taxName: item.suggestion!.taxName,
    }));
}

export function dedupeRuleDrafts(
  drafts: WalletBatchRuleDraft[],
): WalletBatchRuleDraft[] {
  const seen = new Set<string>();
  const unique: WalletBatchRuleDraft[] = [];
  for (const draft of drafts) {
    const key = JSON.stringify({
      entrySide: draft.entrySide,
      description: draft.description,
      condition: draft.condition,
      accountItemName: draft.accountItemName,
      taxName: draft.taxName,
      walletable: draft.walletable ?? "",
    });
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(draft);
  }
  return unique;
}
