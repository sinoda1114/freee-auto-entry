import type {
  CreateRecurringInvoiceTemplateInput,
  RecurringInvoiceTemplatePrefill,
} from "@/lib/db/recurring-invoices";
import type { InvoiceDetail } from "./invoice";

export function buildTemplatePrefillFromInvoice(
  invoice: InvoiceDetail,
): RecurringInvoiceTemplatePrefill {
  const subject = invoice.subject.trim();
  return {
    name: subject || `${invoice.partnerName} 請求`,
    partnerId: invoice.partnerId,
    partnerName: invoice.partnerName,
    subject,
    emailTo: invoice.emailTo,
    emailCc: invoice.emailCc,
    sendingMethod: invoice.sendingMethod,
    invoiceTemplateId: invoice.templateId,
    lines: invoice.lines,
  };
}

export function buildTemplateInputFromInvoice(
  companyId: string,
  invoice: InvoiceDetail,
): CreateRecurringInvoiceTemplateInput {
  return {
    companyId,
    ...buildTemplatePrefillFromInvoice(invoice),
  };
}
