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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createInvoiceAction(
  _prevState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeとの連携が切れています。再度ログインしてください。" };
  }
  if (String(formData.get("companyId") ?? "") !== auth.companyId) {
    return {
      status: "error",
      message: "事業所が切り替わりました。画面を更新してください。",
    };
  }

  const billingDate = String(formData.get("billingDate") ?? "");
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const partnerId = Number(formData.get("partnerId"));
  const subject = String(formData.get("subject") ?? "");
  const emailTo = String(formData.get("emailTo") ?? "");
  const emailCcInput = String(formData.get("emailCc") ?? "").trim();
  const emailCcAddresses = emailCcInput
    ? emailCcInput.split(",").map((address) => address.trim())
    : [];
  const emailCc = emailCcAddresses.join(",");
  const descriptions = formData.getAll("lineDescription").map(String);
  const quantities = formData.getAll("lineQuantity").map(Number);
  const unitPriceValues = formData.getAll("lineUnitPrice").map(String);
  const unitPrices = unitPriceValues.map(Number);
  const taxRates = formData.getAll("lineTaxRate").map(Number);
  const lines = descriptions.map((description, index) => ({
    description: description.trim(),
    quantity: quantities[index] ?? 0,
    unitPrice: unitPrices[index] ?? -1,
    taxRate: taxRates[index] ?? -1,
  }));

  if (
    !billingDate ||
    !partnerId ||
    descriptions.length === 0 ||
    descriptions.length !== quantities.length ||
    descriptions.length !== unitPriceValues.length ||
    descriptions.length !== taxRates.length ||
    lines.some(
      (line, index) =>
        !line.description ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.unitPrice) ||
        line.unitPrice < 0 ||
        !/^\d+(?:\.\d{1,3})?$/.test(unitPriceValues[index] ?? "") ||
        !Number.isFinite(line.taxRate) ||
        ![0, 8, 10].includes(line.taxRate),
    )
  ) {
    return { status: "error", message: "すべての項目を入力してください。" };
  }
  if (emailTo && !EMAIL_PATTERN.test(emailTo)) {
    return {
      status: "error",
      message: "送付先TOのメールアドレスを確認してください。",
    };
  }
  if (emailCcAddresses.some((address) => !EMAIL_PATTERN.test(address))) {
    return {
      status: "error",
      message: "送付先CCのメールアドレスを確認してください。",
    };
  }

  try {
    const memoTagId = await getAppMemoTagId(auth);
    const invoice = await createInvoice(auth, {
      billingDate,
      ...(paymentDate ? { paymentDate } : {}),
      partnerId,
      ...(subject ? { subject } : {}),
      ...(emailTo ? { emailTo } : {}),
      ...(emailCc ? { emailCc } : {}),
      ...(emailTo ? { sendingMethod: "email" } : {}),
      lines,
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
