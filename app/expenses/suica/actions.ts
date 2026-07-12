"use server";

import { createDeal } from "@/lib/freee/accounting";
import { getAppMemoTagId } from "@/lib/freee/memo-tag";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  decodeSuicaHandoffPayload,
  type SuicaTransitItem,
} from "@/lib/suica/history";

export interface SuicaExpenseFormState {
  status: "idle" | "success" | "error";
  message?: string;
  dealIds?: number[];
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

  try {
    const memoTagId = await getAppMemoTagId(auth);
    const dealIds: number[] = [];
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
      message: `${dealIds.length}件の経費を登録しました。`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "不明なエラーです。";
    return { status: "error", message };
  }
}
