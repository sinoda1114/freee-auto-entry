import type { FreeeAuth } from "@/lib/freee/accounting";
import {
  getInvoiceListPage,
  type InvoiceSummary,
} from "@/lib/freee/invoice";
import {
  hasInvoiceGeneration,
  listRecurringInvoiceTemplates,
  recordInvoiceGeneration,
  type RecurringInvoiceTemplate,
} from "@/lib/db/recurring-invoices";
import type { Database } from "@/lib/db/types";

function normalizeSubject(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function stripMonthNoise(value: string): string {
  return value
    .replace(/\d{4}年?\d{1,2}月分?/g, "")
    .replace(/\d{1,2}月分/g, "");
}

export function subjectsLikelyMatch(left: string, right: string): boolean {
  const a = normalizeSubject(left);
  const b = normalizeSubject(right);
  if (!a || !b) {
    return false;
  }
  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }
  const sa = stripMonthNoise(a);
  const sb = stripMonthNoise(b);
  if (!sa || !sb) {
    return false;
  }
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

export function billingDateInMonth(
  billingDate: string,
  targetMonth: string,
): boolean {
  return billingDate.slice(0, 7) === targetMonth;
}

export function findMatchingInvoice(
  invoices: InvoiceSummary[],
  template: Pick<RecurringInvoiceTemplate, "partnerId" | "subject">,
  targetMonth: string,
): InvoiceSummary | null {
  const candidates = invoices.filter(
    (invoice) =>
      invoice.partnerId === template.partnerId &&
      billingDateInMonth(invoice.billingDate, targetMonth) &&
      subjectsLikelyMatch(invoice.subject, template.subject),
  );
  if (candidates.length === 0) {
    return null;
  }
  return [...candidates].sort((a, b) =>
    b.billingDate.localeCompare(a.billingDate),
  )[0] ?? null;
}

function monthRange(targetMonth: string): {
  startBillingDate: string;
  endBillingDate: string;
} {
  const [yearRaw, monthRaw] = targetMonth.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startBillingDate: `${targetMonth}-01`,
    endBillingDate: `${targetMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

async function fetchInvoicesForPartners(
  auth: FreeeAuth,
  partnerIds: number[],
  targetMonth: string,
): Promise<InvoiceSummary[]> {
  const { startBillingDate, endBillingDate } = monthRange(targetMonth);
  const collected: InvoiceSummary[] = [];
  for (let i = 0; i < partnerIds.length; i += 3) {
    const batch = partnerIds.slice(i, i + 3);
    for (let offset = 0; ; offset += 100) {
      const page = await getInvoiceListPage(auth, {
        offset,
        limit: 100,
        partnerIds: batch,
        startBillingDate,
        endBillingDate,
      });
      collected.push(...page.invoices);
      if (page.fetchedCount < 100) {
        break;
      }
    }
  }
  return collected;
}

export type ReconcileRecurringResult = {
  scannedTemplates: number;
  linked: number;
  alreadyLinked: number;
  unmatched: number;
  linkedItems: Array<{
    templateId: string;
    templateName: string;
    targetMonth: string;
    invoiceId: number;
    invoiceNumber: string;
  }>;
};

export async function reconcileRecurringInvoiceHistory(input: {
  auth: FreeeAuth;
  db: Database;
  targetMonths: string[];
}): Promise<ReconcileRecurringResult> {
  const templates = (
    await listRecurringInvoiceTemplates(input.db, input.auth.companyId)
  ).filter((template) => template.active);

  const result: ReconcileRecurringResult = {
    scannedTemplates: templates.length,
    linked: 0,
    alreadyLinked: 0,
    unmatched: 0,
    linkedItems: [],
  };

  if (templates.length === 0 || input.targetMonths.length === 0) {
    return result;
  }

  const partnerIds = [
    ...new Set(templates.map((template) => template.partnerId)),
  ];

  for (const targetMonth of input.targetMonths) {
    const invoices = await fetchInvoicesForPartners(
      input.auth,
      partnerIds,
      targetMonth,
    );

    for (const template of templates) {
      const key = {
        companyId: input.auth.companyId,
        templateId: template.id,
        targetMonth,
      };
      if (await hasInvoiceGeneration(input.db, key)) {
        result.alreadyLinked += 1;
        continue;
      }
      const match = findMatchingInvoice(invoices, template, targetMonth);
      if (!match) {
        result.unmatched += 1;
        continue;
      }
      try {
        await recordInvoiceGeneration(input.db, {
          ...key,
          invoiceId: match.id,
          reportUrl: match.reportUrl,
        });
        result.linked += 1;
        result.linkedItems.push({
          templateId: template.id,
          templateName: template.name,
          targetMonth,
          invoiceId: match.id,
          invoiceNumber: match.invoiceNumber,
        });
      } catch {
        // Unique race or write failure — treat as already linked if present.
        if (await hasInvoiceGeneration(input.db, key)) {
          result.alreadyLinked += 1;
        } else {
          result.unmatched += 1;
        }
      }
    }
  }

  return result;
}
