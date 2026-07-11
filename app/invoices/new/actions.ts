"use server";

import { getAppMemoTagId } from "@/lib/freee/memo-tag";
import { createInvoice } from "@/lib/freee/invoice";
import { getValidFreeeAuth } from "@/lib/freee/session-client";

export interface InvoiceFormState {
  status: "idle" | "success" | "error";
  message?: string;
  invoiceId?: number;
  reportUrl?: string;
}

export async function createInvoiceAction(
  _prevState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeとの連携が切れています。再度ログインしてください。" };
  }

  const billingDate = String(formData.get("billingDate") ?? "");
  const partnerId = Number(formData.get("partnerId"));
  const description = String(formData.get("description") ?? "");
  const quantity = Number(formData.get("quantity"));
  const unitPrice = Number(formData.get("unitPrice"));
  const taxRate = Number(formData.get("taxRate"));

  if (!billingDate || !partnerId || !description || !quantity || !unitPrice) {
    return { status: "error", message: "すべての項目を入力してください。" };
  }

  try {
    const memoTagId = await getAppMemoTagId(auth);
    const invoice = await createInvoice(auth, {
      billingDate,
      partnerId,
      lines: [{ description, quantity, unitPrice, taxRate }],
      memoTagIds: [memoTagId],
    });
    return {
      status: "success",
      invoiceId: invoice.id,
      reportUrl: invoice.reportUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return { status: "error", message };
  }
}
