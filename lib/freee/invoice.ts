import type { FreeeAuth } from "./accounting";

const INVOICE_API_BASE = "https://api.freee.co.jp/iv";

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CreateInvoiceInput {
  billingDate: string;
  partnerId: number;
  lines: InvoiceLineInput[];
  memoTagIds?: number[];
}

export interface CreatedInvoice {
  id: number;
  reportUrl: string;
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
      partner_id: input.partnerId,
      partner_title: "御中",
      tax_entry_method: "out",
      tax_fraction: "omit",
      withholding_tax_entry_method: "out",
      lines: input.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
        ...(input.memoTagIds ? { tag_ids: input.memoTagIds } : {}),
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee invoice API request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return { id: data.invoice.id, reportUrl: data.invoice.report_url };
}
