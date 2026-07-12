/** 1リクエストあたりの上限（Vercel / freee タイムアウト回避） */
export const SUICA_EXPENSE_BATCH_LIMIT = 15;

export interface SuicaExpenseFormState {
  status: "idle" | "success" | "error";
  message?: string;
  dealIds?: number[];
  /** 成功した件数（部分成功時も） */
  registeredCount?: number;
  /** 既存と判定してスキップした件数 */
  skippedDuplicateCount?: number;
}

export interface SuicaDuplicateCheckResult {
  status: "success" | "error";
  message?: string;
  /** すでに freee にある明細の index */
  duplicateIndexes: number[];
}
