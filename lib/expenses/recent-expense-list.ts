export interface RecentExpenseRow {
  id: number;
  issueDate: string;
  amount: number;
  description: string | null;
  accountItemName: string | null;
}

export const RECENT_EXPENSE_LIMIT = 5;

/**
 * サーバがまだ返していない登録直後の行を残す。
 * id の新しい順に最大 5 件。同じ id はサーバ側を正とする。
 */
export function mergeRecentExpenses(
  serverRows: readonly RecentExpenseRow[],
  justRegistered: readonly RecentExpenseRow[],
): RecentExpenseRow[] {
  const byId = new Map<number, RecentExpenseRow>();
  for (const row of serverRows) {
    byId.set(row.id, row);
  }
  for (const row of justRegistered) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()]
    .sort((left, right) => right.id - left.id)
    .slice(0, RECENT_EXPENSE_LIMIT);
}
