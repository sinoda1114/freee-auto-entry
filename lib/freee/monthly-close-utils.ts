/**
 * 現在の対象月を "YYYY-MM" 形式で返す。
 * テストで差し替えられるよう `now` を引数で受け取る。
 */
export function currentTargetMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** "YYYY-MM" → "YYYY年M月" */
export function formatTargetMonth(targetMonth: string): string {
  const [year, monthStr] = targetMonth.split("-");
  return `${year}年${Number(monthStr)}月`;
}

export interface ChecklistCounts {
  unprocessedWalletTxns: number;
  pendingTemplateCount: number;
  unsentInvoiceCount: number;
}

/** 残タスクが 0 件ならクリア、1 件以上なら要対応 */
export function checklistStatus(
  counts: ChecklistCounts,
): "clear" | "action-required" {
  const total =
    counts.unprocessedWalletTxns +
    counts.pendingTemplateCount +
    counts.unsentInvoiceCount;
  return total === 0 ? "clear" : "action-required";
}
