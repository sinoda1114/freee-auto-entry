import type { FreeeAuth } from "@/lib/freee/accounting";
import { filterInvoicesByQuery } from "@/lib/freee/invoice-list-utils";
import { listInvoicesForUi } from "@/lib/freee/list-invoices-for-ui";

export type ConsultationInvoiceRow = {
  id: number;
  invoiceNumber: string;
  partnerName: string;
  subject: string;
  billingDate: string;
  paymentDate?: string;
  totalAmount: number;
  sendingStatus: "sent" | "unsent";
  paymentStatus: "settled" | "unsettled" | "canceled";
};

export type ListInvoicesForConsultationResult = {
  monthsBack: number;
  startBillingDate: string;
  endBillingDate: string;
  matchedCount: number;
  returnedCount: number;
  query: string;
  invoices: ConsultationInvoiceRow[];
};

/** 「博報堂プロダクツの請求書を…」から検索語を取り出す */
export function extractInvoiceSearchQuery(question: string): string {
  const trimmed = question.trim();
  const beforeInvoice = trimmed.match(/^(.+?)の請求書/);
  if (beforeInvoice?.[1]?.trim()) {
    return beforeInvoice[1].trim();
  }
  return trimmed
    .replace(/ここ|直近/g, "")
    .replace(/[0-9０-９]+|三|四|五|六/g, "")
    .replace(/ヶ?か?月分?/g, "")
    .replace(/リストアップ(して)?/g, "")
    .replace(/請求書/g, "")
    .replace(/を|で|ください|お願い|一覧|表示/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 「ここ三ヶ月」「直近3ヶ月」などから monthsBack を取る */
export function extractInvoiceMonthsBack(question: string): number {
  if (/三[ヶか]?月|３[ヶか]?月/.test(question)) {
    return 3;
  }
  if (/六[ヶか]?月|６[ヶか]?月/.test(question)) {
    return 6;
  }
  const match = question.match(/([0-9０-９]+)\s*[ヶか]?月/);
  if (match?.[1]) {
    const normalized = match[1].replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xff10 + 0x30),
    );
    const value = Number(normalized);
    if (Number.isFinite(value)) {
      return Math.min(36, Math.max(1, value));
    }
  }
  return 3;
}

export function formatInvoicesForConsultationPrompt(
  result: ListInvoicesForConsultationResult,
): string {
  const header = [
    "【事前取得した請求書データ】",
    `検索語: ${result.query || "（なし）"}`,
    `期間: ${result.startBillingDate} 〜 ${result.endBillingDate}（直近${result.monthsBack}ヶ月）`,
    `件数: ${result.matchedCount}件（表示 ${result.returnedCount}件）`,
  ].join("\n");

  if (result.invoices.length === 0) {
    return `${header}\n該当なし。口座明細や元帳には切り替えず、この結果を伝えてください。権限不足とは言わないでください。`;
  }

  const rows = result.invoices.map((invoice, index) => {
    const amount = invoice.totalAmount.toLocaleString("ja-JP");
    const sending =
      invoice.sendingStatus === "sent" ? "送付済" : "未送付";
    const payment =
      invoice.paymentStatus === "settled"
        ? "入金済"
        : invoice.paymentStatus === "canceled"
          ? "取消"
          : "未入金";
    return `${index + 1}. ${invoice.billingDate} / ${invoice.partnerName} / ${invoice.subject} / ¥${amount} / 番号 ${invoice.invoiceNumber || "（なし）"} / ${sending}・${payment}`;
  });

  return `${header}\n${rows.join("\n")}\nこのデータを根拠に日本語で一覧してください。口座明細や総勘定元帳には切り替えないでください。権限不足とは言わないでください。`;
}

/**
 * 相談エージェント用: 請求日の期間窓で請求書を取得し、取引先名・件名などで絞る。
 */
export async function listInvoicesForConsultation(
  auth: FreeeAuth,
  input: {
    monthsBack?: number;
    query?: string;
    limit?: number;
    now?: Date;
  } = {},
): Promise<ListInvoicesForConsultationResult> {
  const monthsBack = input.monthsBack ?? 3;
  const query = input.query?.trim() ?? "";
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
  const listed = await listInvoicesForUi(auth, {
    page: 1,
    pageSize: 1000,
    monthsBack,
    now: input.now,
  });
  const filtered = filterInvoicesByQuery(listed.invoices, query);
  const sliced = filtered.slice(0, limit);

  return {
    monthsBack,
    startBillingDate: listed.startBillingDate,
    endBillingDate: listed.endBillingDate,
    matchedCount: filtered.length,
    returnedCount: sliced.length,
    query,
    invoices: sliced.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      partnerName: invoice.partnerName,
      subject: invoice.subject,
      billingDate: invoice.billingDate,
      paymentDate: invoice.paymentDate,
      totalAmount: invoice.totalAmount,
      sendingStatus: invoice.sendingStatus,
      paymentStatus: invoice.paymentStatus,
    })),
  };
}
