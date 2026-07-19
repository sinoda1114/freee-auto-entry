import type { FreeeAuth } from "./accounting";
import {
  generateInvoiceNumber,
  isInvoiceNumberForbiddenError,
} from "./invoice-number";

const INVOICE_API_BASE = "https://api.freee.co.jp/iv";

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CreateInvoiceInput {
  billingDate: string;
  paymentDate?: string;
  partnerId: number;
  subject?: string;
  emailTo?: string;
  emailCc?: string;
  sendingMethod?: "email" | "posting" | "email_and_posting";
  templateId?: number;
  invoiceNumber?: string;
  lines: InvoiceLineInput[];
  memoTagIds?: number[];
}

export interface InvoiceDocumentTemplate {
  id: number;
  name: string;
}

export interface CreatedInvoice {
  id: number;
  reportUrl: string;
}

export class FreeeInvoiceApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FreeeInvoiceApiError";
  }
}

export interface InvoiceSummary {
  id: number;
  companyId: string;
  invoiceNumber: string;
  subject: string;
  billingDate: string;
  paymentDate?: string;
  sendingStatus: "sent" | "unsent";
  paymentStatus: "settled" | "unsettled" | "canceled";
  dealStatus: "registered" | "unregistered";
  totalAmount: number;
  partnerId: number;
  partnerName: string;
  downloadedStatus?: "downloaded" | "undownloaded";
  reportUrl: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  emailTo: string;
  emailCc: string;
  sendingMethod: "email" | "posting" | "email_and_posting";
  templateId: number | null;
  lines: InvoiceLineInput[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function parseInvoiceSummary(value: unknown): InvoiceSummary {
  if (!isRecord(value)) {
    throw new Error("freee invoice response is invalid");
  }
  const invoiceNumber = coerceString(value.invoice_number);
  const subject = coerceString(value.subject);
  if (
    typeof value.id !== "number" ||
    (typeof value.company_id !== "number" &&
      typeof value.company_id !== "string") ||
    invoiceNumber === undefined ||
    subject === undefined ||
    typeof value.billing_date !== "string" ||
    (value.sending_status !== "sent" && value.sending_status !== "unsent") ||
    (value.payment_status !== "settled" &&
      value.payment_status !== "unsettled" &&
      value.payment_status !== "canceled") ||
    (value.deal_status !== "registered" &&
      value.deal_status !== "unregistered" &&
      value.deal_status !== undefined) ||
    typeof value.total_amount !== "number" ||
    typeof value.partner_id !== "number" ||
    typeof value.report_url !== "string"
  ) {
    throw new Error("freee invoice response is invalid");
  }
  const downloadedStatus =
    value.email_url_file_downloaded_status === "downloaded" ||
    value.email_url_file_downloaded_status === "undownloaded"
      ? value.email_url_file_downloaded_status
      : undefined;

  return {
    id: value.id,
    companyId: String(value.company_id),
    invoiceNumber,
    subject,
    billingDate: value.billing_date,
    paymentDate: optionalString(value.payment_date),
    sendingStatus: value.sending_status,
    paymentStatus: value.payment_status,
    dealStatus:
      value.deal_status === "registered" || value.deal_status === "unregistered"
        ? value.deal_status
        : "unregistered",
    totalAmount: value.total_amount,
    partnerId: value.partner_id,
    partnerName:
      optionalString(value.partner_display_name) ??
      optionalString(value.partner_name) ??
      `取引先 ${value.partner_id}`,
    downloadedStatus,
    reportUrl: value.report_url,
  };
}

function tryParseInvoiceSummary(value: unknown): InvoiceSummary | null {
  try {
    return parseInvoiceSummary(value);
  } catch (error) {
    const id =
      isRecord(value) && value.id !== undefined ? String(value.id) : "unknown";
    console.error("[freee] skipped unparsable invoice", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function createInvoice(
  auth: FreeeAuth,
  input: CreateInvoiceInput,
): Promise<CreatedInvoice> {
  const res = await fetch(`${INVOICE_API_BASE}/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      company_id: Number(auth.companyId),
      billing_date: input.billingDate,
      ...(input.paymentDate ? { payment_date: input.paymentDate } : {}),
      ...(input.subject ? { subject: input.subject } : {}),
      partner_id: input.partnerId,
      partner_title: "御中",
      ...(input.emailTo
        ? { partner_contact_email_to: input.emailTo }
        : {}),
      ...(input.emailCc
        ? { partner_contact_email_cc: input.emailCc }
        : {}),
      ...(input.sendingMethod
        ? { partner_sending_method: input.sendingMethod }
        : {}),
      ...(input.templateId ? { template_id: input.templateId } : {}),
      ...(input.invoiceNumber
        ? { invoice_number: input.invoiceNumber }
        : {}),
      tax_entry_method: "out",
      tax_fraction: "omit",
      withholding_tax_entry_method: "out",
      lines: input.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unit_price: String(line.unitPrice),
        tax_rate: line.taxRate,
        ...(input.memoTagIds ? { tag_ids: input.memoTagIds } : {}),
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new FreeeInvoiceApiError(
      res.status,
      `freee invoice API request failed: ${res.status} ${text}`,
    );
  }

  const data: unknown = await res.json();
  if (
    !isRecord(data) ||
    !isRecord(data.invoice) ||
    typeof data.invoice.id !== "number" ||
    typeof data.invoice.report_url !== "string"
  ) {
    throw new Error("freee created invoice response is invalid");
  }
  return { id: data.invoice.id, reportUrl: data.invoice.report_url };
}

/**
 * Create invoice with a number by default (auto-numbering OFF companies).
 * If freee rejects a supplied number (auto-numbering ON), retry without it.
 */
export async function createInvoiceResilient(
  auth: FreeeAuth,
  input: CreateInvoiceInput,
): Promise<CreatedInvoice> {
  const provided = input.invoiceNumber?.trim();
  const invoiceNumber =
    provided ||
    generateInvoiceNumber({
      billingDate: input.billingDate,
      partnerId: input.partnerId,
    });

  try {
    return await createInvoice(auth, { ...input, invoiceNumber });
  } catch (error) {
    if (provided || !isInvoiceNumberForbiddenError(error)) {
      throw error;
    }
    return createInvoice(auth, { ...input, invoiceNumber: undefined });
  }
}

export type GetInvoicesFilters = {
  offset: number;
  limit: number;
  startBillingDate?: string;
  endBillingDate?: string;
  partnerIds?: number[];
  paymentStatus?: "settled" | "unsettled" | "canceled";
  dealStatus?: "registered" | "unregistered";
  sendingStatus?: "sent" | "unsent";
};

export type InvoiceListPage = {
  invoices: InvoiceSummary[];
  /** Raw row count from freee before soft-parse skips (for pagination). */
  fetchedCount: number;
};

export async function getInvoiceListPage(
  auth: FreeeAuth,
  pagination: GetInvoicesFilters,
): Promise<InvoiceListPage> {
  const params = new URLSearchParams({
    company_id: auth.companyId,
    offset: String(pagination.offset),
    limit: String(pagination.limit),
  });
  if (pagination.startBillingDate) {
    params.set("start_billing_date", pagination.startBillingDate);
  }
  if (pagination.endBillingDate) {
    params.set("end_billing_date", pagination.endBillingDate);
  }
  if (pagination.partnerIds && pagination.partnerIds.length > 0) {
    params.set(
      "partner_ids",
      pagination.partnerIds.slice(0, 3).map(String).join(","),
    );
  }
  if (pagination.paymentStatus) {
    params.set("payment_status", pagination.paymentStatus);
  }
  if (pagination.dealStatus) {
    params.set("deal_status", pagination.dealStatus);
  }
  if (pagination.sendingStatus) {
    params.set("sending_status", pagination.sendingStatus);
  }
  const response = await fetch(`${INVOICE_API_BASE}/invoices?${params}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`freee invoice API request failed: ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.invoices)) {
    throw new Error("freee invoices response is invalid");
  }
  const invoices = data.invoices.flatMap((row) => {
    const parsed = tryParseInvoiceSummary(row);
    return parsed ? [parsed] : [];
  });
  return { invoices, fetchedCount: data.invoices.length };
}

export async function getInvoices(
  auth: FreeeAuth,
  pagination: GetInvoicesFilters,
): Promise<InvoiceSummary[]> {
  const page = await getInvoiceListPage(auth, pagination);
  return page.invoices;
}

export async function getUnsentInvoiceCount(
  auth: FreeeAuth,
  pageSize = 100,
): Promise<number> {
  let count = 0;
  for (let offset = 0; ; offset += pageSize) {
    const page = await getInvoiceListPage(auth, { offset, limit: pageSize });
    count += page.invoices.filter(
      (invoice) => invoice.sendingStatus === "unsent",
    ).length;
    if (page.fetchedCount < pageSize) {
      return count;
    }
  }
}

function parseSendingMethod(
  value: unknown,
): "email" | "posting" | "email_and_posting" {
  return value === "email" ||
    value === "posting" ||
    value === "email_and_posting"
    ? value
    : "email";
}

function parseInvoiceLine(value: unknown): InvoiceLineInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const line = value as Record<string, unknown>;
  if (line.type === "text") {
    return null;
  }
  const description =
    typeof line.description === "string" ? line.description.trim() : "";
  const quantity =
    typeof line.quantity === "number" ? line.quantity : Number(line.quantity);
  const unitPriceRaw =
    typeof line.unit_price === "string"
      ? line.unit_price
      : typeof line.unit_price === "number"
        ? String(line.unit_price)
        : "";
  const unitPrice = Number(unitPriceRaw);
  const taxRate =
    typeof line.tax_rate === "number" ? line.tax_rate : Number(line.tax_rate);
  if (
    !description ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    ![0, 8, 10].includes(taxRate)
  ) {
    return null;
  }
  return { description, quantity, unitPrice, taxRate };
}

function parseInvoiceDetail(value: unknown): InvoiceDetail {
  if (!isRecord(value)) {
    throw new Error("freee invoice response is invalid");
  }
  const summary = parseInvoiceSummary(value);
  const linesRaw = value.lines;
  const lines = Array.isArray(linesRaw)
    ? linesRaw
        .map(parseInvoiceLine)
        .filter((line): line is InvoiceLineInput => line !== null)
    : [];
  if (lines.length === 0) {
    throw new Error("freee invoice has no billable lines");
  }
  return {
    ...summary,
    emailTo: optionalString(value.partner_contact_email_to) ?? "",
    emailCc: optionalString(value.partner_contact_email_cc) ?? "",
    sendingMethod: parseSendingMethod(value.partner_sending_method),
    templateId:
      typeof value.template_id === "number" ? value.template_id : null,
    lines,
  };
}

export async function getInvoiceTemplates(
  auth: FreeeAuth,
): Promise<InvoiceDocumentTemplate[]> {
  const params = new URLSearchParams({
    company_id: auth.companyId,
  });
  const response = await fetch(`${INVOICE_API_BASE}/invoices/templates?${params}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `freee invoice template API request failed: ${response.status}`,
    );
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.templates)) {
    throw new Error("freee invoice templates response is invalid");
  }
  return data.templates.flatMap((template) => {
    if (
      !isRecord(template) ||
      typeof template.id !== "number" ||
      typeof template.name !== "string"
    ) {
      return [];
    }
    return [{ id: template.id, name: template.name }];
  });
}

export async function getInvoice(
  auth: FreeeAuth,
  invoiceId: number,
): Promise<InvoiceDetail> {
  const params = new URLSearchParams({
    company_id: auth.companyId,
  });
  const response = await fetch(
    `${INVOICE_API_BASE}/invoices/${invoiceId}?${params}`,
    {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    },
  );
  if (!response.ok) {
    throw new Error(`freee invoice API request failed: ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || !isRecord(data.invoice)) {
    throw new Error("freee invoice response is invalid");
  }
  const invoice = parseInvoiceDetail(data.invoice);
  if (invoice.companyId !== auth.companyId) {
    throw new Error("請求書の事業所が一致しません。");
  }
  return invoice;
}
