"use server";

import { extractReceiptOcr, type OcrResult } from "@/lib/ai/receipt-ocr";
import {
  createDeal,
  getAccountItems,
  getTaxCodes,
} from "@/lib/freee/accounting";
import { resolveOfficerFundsPayment } from "@/lib/expenses/officer-funds";
import { getAppMemoTagId } from "@/lib/freee/memo-tag";
import { uploadReceipt } from "@/lib/freee/receipts";
import { getValidFreeeAuth } from "@/lib/freee/session-client";

export interface ExpenseFormState {
  status: "idle" | "success" | "error";
  message?: string;
  dealId?: number;
}

export interface OcrActionResult {
  status: "success" | "error";
  message?: string;
  receiptId?: number;
  ocrResult?: OcrResult;
}

export async function ocrReceiptAction(formData: FormData): Promise<OcrActionResult> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeとの連携が切れています。再度ログインしてください。" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "ファイルを選択してください。" };
  }

  try {
    const [accountItems, taxCodes] = await Promise.all([
      getAccountItems(auth),
      getTaxCodes(auth),
    ]);

    const arrayBuffer = await file.arrayBuffer();

    const { id: receiptId } = await uploadReceipt(
      auth,
      arrayBuffer,
      file.name,
      file.type || "application/octet-stream",
    );

    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    const ocrResult = await extractReceiptOcr(
      imageBase64,
      file.type || "application/octet-stream",
      accountItems,
      taxCodes,
    );

    return { status: "success", receiptId, ocrResult };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return { status: "error", message };
  }
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
  const receiptIdRaw = formData.get("receiptId");
  const receiptIds =
    receiptIdRaw && Number(receiptIdRaw) > 0
      ? [Number(receiptIdRaw)]
      : undefined;

  if (!issueDate || !accountItemId || !taxCode || !amount) {
    return { status: "error", message: "発生日・勘定科目・税区分・金額を入力してください。" };
  }

  try {
    const [memoTagId, accountItems] = await Promise.all([
      getAppMemoTagId(auth),
      getAccountItems(auth),
    ]);
    const officerFunds = resolveOfficerFundsPayment(
      accountItems,
      issueDate,
      amount,
    );
    if (!officerFunds.ok) {
      return { status: "error", message: officerFunds.message };
    }

    const deal = await createDeal(auth, {
      issueDate,
      accountItemId,
      taxCode,
      amount,
      ...(description.trim() ? { description: description.trim() } : {}),
      memoTagIds: memoTagId ? [memoTagId] : undefined,
      receiptIds,
      payment: officerFunds.payment,
    });

    return {
      status: "success",
      dealId: deal.id,
      message: "役員資金で決済まで登録しました。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return { status: "error", message };
  }
}
