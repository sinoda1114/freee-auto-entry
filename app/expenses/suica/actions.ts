"use server";

import { createDeal } from "@/lib/freee/accounting";
import { getAppMemoTagId } from "@/lib/freee/memo-tag";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  decodeSuicaHandoffPayload,
  type SuicaTransitItem,
} from "@/lib/suica/history";

export interface SuicaExpenseFormState {
  status: "idle" | "success" | "partial" | "error";
  message?: string;
  dealIds?: number[];
  /** 登録に成功した明細のインデックス（UI で再送時の重複を防ぐため返す） */
  registeredIndexes?: number[];
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
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < items.length);

  const selectedIndexes =
    indexes.length > 0 ? indexes : items.map((_, i) => i);
  const selected = selectedIndexes.map((i) => ({ index: i, item: items[i]! }));

  if (selected.length === 0) {
    return { status: "error", message: "登録する明細を選択してください。" };
  }

  let memoTagId: number;
  try {
    memoTagId = await getAppMemoTagId(auth);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "不明なエラーです。";
    return { status: "error", message };
  }

  const dealIds: number[] = [];
  const registeredIndexes: number[] = [];
  for (const { index, item } of selected) {
    try {
      const deal = await createDeal(auth, {
        issueDate: item.date,
        accountItemId,
        taxCode,
        amount: item.amount,
        description: item.description,
        memoTagIds: memoTagId ? [memoTagId] : undefined,
      });
      dealIds.push(deal.id);
      registeredIndexes.push(index);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "不明なエラーです。";
      if (dealIds.length === 0) {
        return { status: "error", message: reason };
      }
      return {
        status: "partial",
        dealIds,
        registeredIndexes,
        message: `${dealIds.length}件を登録しましたが、残りでエラーが発生しました（${reason}）。登録済みの明細は選択から外れます。再登録すると重複するため、未登録分のみを再送してください。`,
      };
    }
  }

  return {
    status: "success",
    dealIds,
    registeredIndexes,
    message: `${dealIds.length}件の経費を登録しました。`,
  };
}
