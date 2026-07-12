import type { SuicaTransitItem } from "./history";

/**
 * 重複判定用の指紋。
 * 残額表記・履歴ID表記を除いた「日付|金額|本文」で照合する。
 */
export function normalizeSuicaDescription(description: string): string {
  return description
    .replace(/（残\d+）\s*$/u, "")
    .replace(/\s*#\d+\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function suicaFingerprint(
  date: string,
  amount: number,
  description: string,
): string {
  return `${date}|${amount}|${normalizeSuicaDescription(description)}`;
}

export function fingerprintFromItem(item: SuicaTransitItem): string {
  return suicaFingerprint(item.date, item.amount, item.description);
}

/** freee 登録用の摘要（残額を付けて同一区間の再識別をしやすくする） */
export function formatSuicaExpenseDescription(item: SuicaTransitItem): string {
  const base = normalizeSuicaDescription(item.description);
  if (item.balance > 0) {
    return `${base}（残${item.balance}）`;
  }
  return base;
}

export function partitionByExistingFingerprints(
  items: SuicaTransitItem[],
  existing: ReadonlySet<string>,
): { fresh: SuicaTransitItem[]; duplicates: SuicaTransitItem[]; freshIndexes: number[]; duplicateIndexes: number[] } {
  const fresh: SuicaTransitItem[] = [];
  const duplicates: SuicaTransitItem[] = [];
  const freshIndexes: number[] = [];
  const duplicateIndexes: number[] = [];

  items.forEach((item, index) => {
    const fp = fingerprintFromItem(item);
    if (existing.has(fp)) {
      duplicates.push(item);
      duplicateIndexes.push(index);
    } else {
      fresh.push(item);
      freshIndexes.push(index);
    }
  });

  return { fresh, duplicates, freshIndexes, duplicateIndexes };
}
