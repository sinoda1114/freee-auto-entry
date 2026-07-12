"use server";

import { createDeal } from "@/lib/freee/accounting";
import { getAppMemoTagId } from "@/lib/freee/memo-tag";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  decodeSuicaHandoffPayload,
  type SuicaTransitItem,
} from "@/lib/suica/history";

/** 1リクエストあたりの上限（Vercel / freee タイムアウト回避） */
export const SUICA_EXPENSE_BATCH_LIMIT = 15;

export interface SuicaExpenseFormState {
  status: "idle" | "success" | "error";
  message?: string;
  dealIds?: number[];
  /** 成功した件数（部分成功時も） */
  registeredCount?: number;
}

export async function createSuicaExpensesAction(
  _prev: SuicaExpenseFormState,
  formData: FormData,
): Promise<SuicaExpenseFormState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return {
      status: "error",
      message: "freeeとの連携が切れています。再度ログインしてください。",
    };
  }

  const encodedItems = String(formData.get("encodedItems") ?? "");
  const accountItemId = Number(formData.get("accountItemId"));
  const taxCode = Number(formData.get("taxCode"));
  const selectedRaw = String(formData.get("selectedIndexes") ?? "");

  if (!encodedItems || !accountItemId || !taxCode) {
    return {
      status: "error",
      message: "勘定科目・税区分と明細を指定してください。",
    };
  }

  let items: SuicaTransitItem[];
  try {
    items = decodeSuicaHandoffPayload(encodedItems).items;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "明細の読み取りに失敗しました。";
    return { status: "error", message };
  }

  const indexes = selectedRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < items.length);

  const selected =
    indexes.length > 0 ? indexes.map((i) => items[i]!).filter(Boolean) : items;

  if (selected.length === 0) {
    return { status: "error", message: "登録する明細を選択してください。" };
  }

  if (selected.length > SUICA_EXPENSE_BATCH_LIMIT) {
    return {
      status: "error",
      message: `1回あたり最大 ${SUICA_EXPENSE_BATCH_LIMIT} 件までです（今回 ${selected.length} 件）。画面側で分割して再送してください。`,
    };
  }

  const dealIds: number[] = [];
  try {
    const memoTagId = await getAppMemoTagId(auth);
    for (const item of selected) {
      const deal = await createDeal(auth, {
        issueDate: item.date,
        accountItemId,
        taxCode,
        amount: item.amount,
        description: item.description,
        memoTagIds: memoTagId ? [memoTagId] : undefined,
      });
      dealIds.push(deal.id);
    }
    return {
      status: "success",
      dealIds,
      registeredCount: dealIds.length,
      message: `${dealIds.length}件の経費を登録しました。`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "不明なエラーです。";
    if (dealIds.length > 0) {
      return {
        status: "error",
        dealIds,
        registeredCount: dealIds.length,
        message: `${dealIds.length}件まで登録したあと失敗しました: ${message}`,
      };
    }
    return { status: "error", message };
  }
}
