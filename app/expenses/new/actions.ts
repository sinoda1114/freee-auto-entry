"use server";

import { createDeal } from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { getAppMemoTagId } from "@/lib/freee/memo-tag";

export interface ExpenseFormState {
  status: "idle" | "success" | "error";
  message?: string;
  dealId?: number;
}

export async function createExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeとの連携が切れています。再度ログインしてください。" };
  }

  const issueDate = String(formData.get("issueDate") ?? "");
  const accountItemId = Number(formData.get("accountItemId"));
  const taxCode = Number(formData.get("taxCode"));
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "");

  if (!issueDate || !accountItemId || !taxCode || !amount || !description) {
    return { status: "error", message: "すべての項目を入力してください。" };
  }

  try {
    const memoTagId = await getAppMemoTagId(auth);
    const deal = await createDeal(auth, {
      issueDate,
      accountItemId,
      taxCode,
      amount,
      description,
      memoTagIds: memoTagId ? [memoTagId] : undefined,
    });
    return { status: "success", dealId: deal.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return { status: "error", message };
  }
}
