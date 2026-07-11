import {
  resolveTaxNameForAccountItem,
  type AccountItem,
  type TaxCode,
} from "./accounting";
import {
  descriptionMatches,
  type CreateMatcherCondition,
  type UserMatcher,
  type WalletTransaction,
} from "./wallet";

export type MatcherSuggestionSource =
  | "auto_rule"
  | "inference_rule"
  | "fuzzy_rule";

export interface MatcherFieldSuggestion {
  accountItemName: string;
  taxName: string;
  condition: CreateMatcherCondition;
  source: MatcherSuggestionSource;
}

function isSuggestionMatcher(matcher: UserMatcher): boolean {
  return matcher.active && (matcher.act === 0 || matcher.act === 1);
}

function matcherAppliesToTransaction(
  transaction: WalletTransaction,
  matcher: UserMatcher,
  walletableName?: string,
): boolean {
  const amount = Math.abs(transaction.amount);
  return (
    matcher.entrySide === transaction.entrySide &&
    (matcher.walletable === undefined || matcher.walletable === walletableName) &&
    (matcher.minAmount === undefined || amount >= matcher.minAmount) &&
    (matcher.maxAmount === undefined || amount <= matcher.maxAmount) &&
    Boolean(matcher.accountItemName)
  );
}

function sourceForMatcher(matcher: UserMatcher): MatcherSuggestionSource {
  if (matcher.act === 1) {
    return "auto_rule";
  }
  return "inference_rule";
}

function suggestionFromMatcher(
  matcher: UserMatcher,
  source: MatcherSuggestionSource,
): MatcherFieldSuggestion | null {
  if (!matcher.accountItemName) {
    return null;
  }

  const condition =
    matcher.condition === 4 ? 0 : (matcher.condition as CreateMatcherCondition);

  return {
    accountItemName: matcher.accountItemName,
    taxName: matcher.taxName ?? "",
    condition,
    source,
  };
}

function scoreFuzzyMatcher(
  transaction: WalletTransaction,
  matcher: UserMatcher,
): number {
  const description = transaction.description;
  const expected = matcher.description.trim();
  if (!expected) {
    return 0;
  }

  if (description.includes(expected)) {
    return expected.length * 2 + (matcher.act === 1 ? 20 : 10);
  }

  if (expected.includes(description)) {
    return description.length + (matcher.act === 1 ? 10 : 5);
  }

  let prefixLength = 0;
  for (
    let index = 0;
    index < Math.min(description.length, expected.length);
    index += 1
  ) {
    if (description[index] !== expected[index]) {
      break;
    }
    prefixLength += 1;
  }

  if (prefixLength >= 4) {
    return prefixLength + (matcher.act === 1 ? 5 : 0);
  }

  return 0;
}

function findExactSuggestion(
  transaction: WalletTransaction,
  matchers: UserMatcher[],
  walletableName?: string,
): MatcherFieldSuggestion | null {
  const exactMatcher = matchers.find(
    (matcher) =>
      isSuggestionMatcher(matcher) &&
      matcherAppliesToTransaction(transaction, matcher, walletableName) &&
      descriptionMatches(
        transaction.description,
        matcher.description,
        matcher.condition,
      ),
  );

  if (!exactMatcher) {
    return null;
  }

  return suggestionFromMatcher(exactMatcher, sourceForMatcher(exactMatcher));
}

function findFuzzySuggestion(
  transaction: WalletTransaction,
  matchers: UserMatcher[],
  walletableName?: string,
): MatcherFieldSuggestion | null {
  let best:
    | {
        matcher: UserMatcher;
        score: number;
      }
    | undefined;

  for (const matcher of matchers) {
    if (
      !isSuggestionMatcher(matcher) ||
      !matcherAppliesToTransaction(transaction, matcher, walletableName)
    ) {
      continue;
    }

    const score = scoreFuzzyMatcher(transaction, matcher);
    if (score <= 0) {
      continue;
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score && matcher.priority < best.matcher.priority)
    ) {
      best = { matcher, score };
    }
  }

  if (!best) {
    return null;
  }

  const suggestion = suggestionFromMatcher(
    best.matcher,
    best.matcher.act === 1 ? "fuzzy_rule" : "inference_rule",
  );
  if (!suggestion) {
    return null;
  }

  if (best.score < best.matcher.description.trim().length * 2) {
    suggestion.condition = 0;
  }

  return suggestion;
}

function withTaxFallback(
  suggestion: MatcherFieldSuggestion,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): MatcherFieldSuggestion {
  if (suggestion.taxName) {
    return suggestion;
  }

  const taxName = resolveTaxNameForAccountItem(
    suggestion.accountItemName,
    accountItems,
    taxCodes,
  );
  if (!taxName) {
    return suggestion;
  }

  return { ...suggestion, taxName };
}

export function suggestMatcherFields(
  transaction: WalletTransaction,
  matchers: UserMatcher[],
  walletableName: string | undefined,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): MatcherFieldSuggestion | null {
  const exact = findExactSuggestion(transaction, matchers, walletableName);
  if (exact) {
    return withTaxFallback(exact, accountItems, taxCodes);
  }

  const fuzzy = findFuzzySuggestion(transaction, matchers, walletableName);
  if (fuzzy) {
    return withTaxFallback(fuzzy, accountItems, taxCodes);
  }

  return null;
}

export function matcherSuggestionSourceLabel(
  source: MatcherSuggestionSource,
): string {
  switch (source) {
    case "auto_rule":
      return "自動登録ルール";
    case "inference_rule":
      return "freee推測ルール";
    case "fuzzy_rule":
      return "類似ルール";
  }
}
