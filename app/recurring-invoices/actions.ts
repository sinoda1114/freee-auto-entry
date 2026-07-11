"use server";

import { revalidatePath } from "next/cache";
import {
  claimInvoiceGeneration,
  createRecurringInvoiceTemplate,
  deleteRecurringInvoiceTemplate,
  getInvoiceGenerationClaimResult,
  getRecordedInvoiceGeneration,
  getRecurringInvoiceTemplate,
  markInvoiceGenerationStarted,
  recordInvoiceGeneration,
  releaseInvoiceGenerationClaim,
  saveInvoiceGenerationClaimResult,
  setRecurringInvoiceTemplateActive,
  updateRecurringInvoiceTemplate,
  type InvoiceSendingMethod,
  type InvoiceTemplateLine,
} from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
import { createInvoice, FreeeInvoiceApiError } from "@/lib/freee/invoice";
import { getAppMemoTagId } from "@/lib/freee/memo-tag";
import { getValidFreeeAuth } from "@/lib/freee/session-client";

export interface TemplateActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export interface GenerateInvoiceState {
  status: "idle" | "success" | "error" | "duplicate";
  message?: string;
  invoiceId?: number;
  reportUrl?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmailCc(value: string): string | null {
  if (!value.trim()) {
    return "";
  }
  const addresses = value.split(",").map((address) => address.trim());
  return addresses.every((address) => EMAIL_PATTERN.test(address))
    ? addresses.join(",")
    : null;
}

function parsePartner(value: string): { id: number; name: string } | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      typeof parsed.id === "number" &&
      "name" in parsed &&
      typeof parsed.name === "string"
    ) {
      return { id: parsed.id, name: parsed.name };
    }
    return null;
  } catch {
    return null;
  }
}

function parseSendingMethod(value: string): InvoiceSendingMethod | null {
  return value === "email" ||
    value === "posting" ||
    value === "email_and_posting"
    ? value
    : null;
}

function parseLines(formData: FormData): InvoiceTemplateLine[] | null {
  const descriptions = formData.getAll("lineDescription").map(String);
  const quantities = formData.getAll("lineQuantity").map(Number);
  const unitPriceValues = formData.getAll("lineUnitPrice").map(String);
  const unitPrices = unitPriceValues.map(Number);
  const taxRates = formData.getAll("lineTaxRate").map(Number);
  if (
    descriptions.length === 0 ||
    descriptions.length !== quantities.length ||
    descriptions.length !== unitPrices.length ||
    descriptions.length !== taxRates.length
  ) {
    return null;
  }

  const lines = descriptions.map((description, index) => ({
      description: description.trim(),
      quantity: quantities[index] ?? 0,
      unitPrice: unitPrices[index] ?? 0,
      unitPriceValue: unitPriceValues[index] ?? "",
      taxRate: taxRates[index] ?? -1,
    }));
  if (
    lines.length === 0 ||
    lines.some(
      (line) =>
        !line.description ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.unitPrice) ||
        line.unitPrice < 0 ||
        !/^\d+(?:\.\d{1,3})?$/.test(line.unitPriceValue) ||
        ![0, 8, 10].includes(line.taxRate),
    )
  ) {
    return null;
  }
  return lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxRate: line.taxRate,
  }));
}

function parseInvoiceTemplateId(formData: FormData): number | null | undefined {
  const raw = String(formData.get("invoiceTemplateId") ?? "").trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export async function saveTemplateAction(
  _previousState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeへ再連携してください。" };
  }
  if (String(formData.get("companyId") ?? "") !== auth.companyId) {
    return {
      status: "error",
      message: "事業所が切り替わりました。画面を更新してください。",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const partner = parsePartner(String(formData.get("partner") ?? ""));
  const subject = String(formData.get("subject") ?? "").trim();
  const emailTo = String(formData.get("emailTo") ?? "").trim();
  const emailCc = normalizeEmailCc(
    String(formData.get("emailCc") ?? ""),
  );
  const sendingMethod = parseSendingMethod(
    String(formData.get("sendingMethod") ?? ""),
  );
  const lines = parseLines(formData);
  const invoiceTemplateId = parseInvoiceTemplateId(formData);
  if (
    !name ||
    !partner ||
    !sendingMethod ||
    !lines ||
    invoiceTemplateId === undefined ||
    (emailTo && !EMAIL_PATTERN.test(emailTo)) ||
    emailCc === null
  ) {
    return {
      status: "error",
      message: "テンプレートの必須項目を正しく入力してください。",
    };
  }

  try {
    const db = getDatabase();
    const templateId = String(formData.get("templateId") ?? "");
    if (templateId) {
      await updateRecurringInvoiceTemplate(db, auth.companyId, {
        id: templateId,
        name,
        partnerId: partner.id,
        partnerName: partner.name,
        subject,
        emailTo,
        emailCc,
        sendingMethod,
        invoiceTemplateId,
        lines,
      });
    } else {
      await createRecurringInvoiceTemplate(db, {
        companyId: auth.companyId,
        name,
        partnerId: partner.id,
        partnerName: partner.name,
        subject,
        emailTo,
        emailCc,
        sendingMethod,
        invoiceTemplateId,
        lines,
      });
    }
    revalidatePath("/recurring-invoices");
    return {
      status: "success",
      message: templateId
        ? "定型請求を更新しました。"
        : "定型請求を登録しました。",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "定型請求を保存できませんでした。",
    };
  }
}

export async function toggleTemplateAction(
  _previousState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const auth = await getValidFreeeAuth();
  if (
    !auth ||
    String(formData.get("companyId") ?? "") !== auth.companyId
  ) {
    return {
      status: "error",
      message: "事業所を確認して、もう一度操作してください。",
    };
  }
  const templateId = String(formData.get("templateId") ?? "");
  const active = formData.get("active") === "true";
  if (!templateId) {
    return { status: "error", message: "定型請求が見つかりません。" };
  }
  try {
    await setRecurringInvoiceTemplateActive(
      getDatabase(),
      auth.companyId,
      templateId,
      active,
    );
    revalidatePath("/recurring-invoices");
    return {
      status: "success",
      message: active ? "定型請求を再開しました。" : "定型請求を停止しました。",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "状態を変更できませんでした。",
    };
  }
}

export async function deleteTemplateAction(
  _previousState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const auth = await getValidFreeeAuth();
  if (
    !auth ||
    String(formData.get("companyId") ?? "") !== auth.companyId
  ) {
    return {
      status: "error",
      message: "事業所を確認して、もう一度操作してください。",
    };
  }
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) {
    return { status: "error", message: "定型請求が見つかりません。" };
  }
  try {
    await deleteRecurringInvoiceTemplate(
      getDatabase(),
      auth.companyId,
      templateId,
    );
    revalidatePath("/recurring-invoices");
    return { status: "success", message: "定型請求を削除しました。" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "削除できませんでした。",
    };
  }
}

export async function generateRecurringInvoiceAction(
  _previousState: GenerateInvoiceState,
  formData: FormData,
): Promise<GenerateInvoiceState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeへ再連携してください。" };
  }
  if (String(formData.get("companyId") ?? "") !== auth.companyId) {
    return {
      status: "error",
      message: "事業所が切り替わりました。画面を更新してください。",
    };
  }

  const templateId = String(formData.get("templateId") ?? "");
  const targetMonth = String(formData.get("targetMonth") ?? "");
  const billingDate = String(formData.get("billingDate") ?? "");
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const confirmed = formData.get("confirmed") === "on";
  if (
    !templateId ||
    !/^\d{4}-\d{2}$/.test(targetMonth) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(billingDate) ||
    (paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) ||
    !confirmed
  ) {
    return {
      status: "error",
      message: "対象月、請求日、確認項目を入力してください。",
    };
  }

  try {
    const db = getDatabase();
    const template = await getRecurringInvoiceTemplate(
      db,
      auth.companyId,
      templateId,
    );
    if (!template) {
      return { status: "error", message: "定型請求が見つかりません。" };
    }
    if (!template.active) {
      return {
        status: "error",
        message: "停止中の定型請求からは請求書を作成できません。",
      };
    }
    const lines = parseLines(formData);
    if (!lines) {
      return {
        status: "error",
        message: "請求明細を正しく入力してください。",
      };
    }
    const emailTo = String(
      formData.get("emailTo") ?? template.emailTo ?? "",
    ).trim();
    const emailCc = normalizeEmailCc(String(
      formData.get("emailCc") ?? template.emailCc ?? "",
    ));
    if (emailTo && !EMAIL_PATTERN.test(emailTo)) {
      return {
        status: "error",
        message: "送付先TOのメールアドレスを確認してください。",
      };
    }
    if (emailCc === null) {
      return {
        status: "error",
        message: "送付先CCのメールアドレスを確認してください。",
      };
    }
    const generationKey = {
      companyId: auth.companyId,
      templateId,
      targetMonth,
    };
    const claimToken = await claimInvoiceGeneration(db, generationKey);
    if (!claimToken) {
      const existingResult =
        (await getInvoiceGenerationClaimResult(db, generationKey)) ??
        (await getRecordedInvoiceGeneration(db, generationKey));
      return {
        status: "duplicate",
        message: existingResult
          ? `${targetMonth}分はすでに作成済みです。作成済みの請求書を確認してください。`
          : `${targetMonth}分は作成済み、または作成処理中です。二重作成を中止しました。`,
        ...(existingResult
          ? {
              invoiceId: existingResult.invoiceId,
              reportUrl: existingResult.reportUrl,
            }
          : {}),
      };
    }
    const generationClaim = { ...generationKey, claimToken };

    let invoice;
    let externalCallStarted = false;
    try {
      const memoTagId = await getAppMemoTagId(auth);
      await markInvoiceGenerationStarted(db, generationClaim);
      externalCallStarted = true;
      invoice = await createInvoice(auth, {
        billingDate,
        ...(paymentDate ? { paymentDate } : {}),
        partnerId: template.partnerId,
        subject: String(formData.get("subject") ?? template.subject),
        emailTo,
        emailCc,
        sendingMethod: template.sendingMethod,
        ...(template.invoiceTemplateId
          ? { templateId: template.invoiceTemplateId }
          : {}),
        lines,
        memoTagIds: [memoTagId],
      });
    } catch (error) {
      if (!externalCallStarted) {
        await releaseInvoiceGenerationClaim(db, generationClaim);
      }
      if (
        externalCallStarted &&
        error instanceof FreeeInvoiceApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        await releaseInvoiceGenerationClaim(db, generationClaim);
        throw error;
      }
      if (externalCallStarted) {
        return {
          status: "error",
          message:
            "freee側の作成結果を確認できませんでした。二重作成を防ぐため、この対象月は再実行せずfreeeの請求書一覧を確認してください。",
        };
      }
      throw error;
    }
    const generationResult = {
      invoiceId: invoice.id,
      reportUrl: invoice.reportUrl,
    };
    try {
      await saveInvoiceGenerationClaimResult(
        db,
        generationClaim,
        generationResult,
      );
    } catch {
      try {
        await recordInvoiceGeneration(db, {
          ...generationKey,
          ...generationResult,
        });
      } catch {
        return {
          status: "success",
          message:
            "請求書は作成されましたが、作成履歴を保存できませんでした。この請求書を確認し、同じ月で再作成しないでください。",
          ...generationResult,
        };
      }
      try {
        await releaseInvoiceGenerationClaim(db, generationClaim);
      } catch {
        // History is durable, so the retained lock cannot cause a duplicate.
      }
      revalidatePath("/recurring-invoices");
      revalidatePath("/invoices");
      return {
        status: "success",
        message: "請求書を作成しました。送付はfreeeで行ってください。",
        ...generationResult,
      };
    }
    try {
      await recordInvoiceGeneration(db, {
        ...generationKey,
        ...generationResult,
      });
    } catch {
      return {
        status: "success",
        message:
          "請求書は作成されました。履歴の確定は保留中ですが、再表示後も作成済み請求書を確認できます。",
        ...generationResult,
      };
    }
    try {
      await releaseInvoiceGenerationClaim(db, generationClaim);
    } catch {
      // History is durable, so the retained lock cannot cause a duplicate.
    }
    revalidatePath("/recurring-invoices");
    revalidatePath("/invoices");
    return {
      status: "success",
      message: "請求書を作成しました。送付はfreeeで行ってください。",
      invoiceId: invoice.id,
      reportUrl: invoice.reportUrl,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "請求書を作成できませんでした。",
    };
  }
}
