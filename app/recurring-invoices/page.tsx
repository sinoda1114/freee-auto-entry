import type { Metadata } from "next";
import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { appPageTitle } from "@/lib/app-brand";
import { listRecurringInvoiceTemplates } from "@/lib/db/recurring-invoices";
import { getDatabase } from "@/lib/db/turso";
import { getInvoiceTemplates } from "@/lib/freee/invoice";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { RecurringInvoicesView } from "./RecurringInvoicesView";

export const metadata: Metadata = {
  title: appPageTitle("定型請求"),
};

export default async function RecurringInvoicesPage() {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <AuthGate title="定型請求" />;
  }

  let templates;
  let invoiceTemplateNames: Record<number, string> = {};
  try {
    const [listedTemplates, documentTemplates] = await Promise.all([
      listRecurringInvoiceTemplates(getDatabase(), auth.companyId),
      getInvoiceTemplates(auth).catch(() => []),
    ]);
    templates = listedTemplates;
    invoiceTemplateNames = Object.fromEntries(
      documentTemplates.map((documentTemplate) => [
        documentTemplate.id,
        documentTemplate.name,
      ]),
    );
  } catch (error) {
    return (
      <PageShell width="md">
        <PageHeader title="定型請求" />
        <p role="alert" className="mt-6 rounded-xl bg-danger-50 p-4 text-danger">
          {error instanceof Error
            ? error.message
            : "定型請求を取得できませんでした。"}
        </p>
      </PageShell>
    );
  }

  return (
    <RecurringInvoicesView
      companyId={auth.companyId}
      templates={templates}
      invoiceTemplateNames={invoiceTemplateNames}
    />
  );
}
