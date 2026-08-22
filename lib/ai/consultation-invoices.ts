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
  invoices: ConsultationInvoiceRow[];
};

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
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
  const listed = await listInvoicesForUi(auth, {
    page: 1,
    pageSize: 1000,
    monthsBack,
    now: input.now,
  });
  const filtered = filterInvoicesByQuery(listed.invoices, input.query ?? "");
  const sliced = filtered.slice(0, limit);

  return {
    monthsBack,
    startBillingDate: listed.startBillingDate,
    endBillingDate: listed.endBillingDate,
    matchedCount: filtered.length,
    returnedCount: sliced.length,
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
