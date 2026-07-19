import type { Metadata } from "next";
import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { appPageTitle } from "@/lib/app-brand";
import { getInvoices } from "@/lib/freee/invoice";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { InvoicesView } from "./InvoicesView";

const PAGE_SIZE = 100;

export const metadata: Metadata = {
  title: appPageTitle("請求書"),
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <AuthGate title="請求書" />;
  }
  const query = await searchParams;
  const requestedPage = Number(query.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let invoices;
  try {
    invoices = await getInvoices(auth, {
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
  } catch (error) {
    return (
      <PageShell width="md">
        <PageHeader title="請求書" />
        <p role="alert" className="mt-6 rounded-xl bg-danger-50 p-4 text-danger">
          {error instanceof Error
            ? error.message
            : "請求書を取得できませんでした。"}
        </p>
      </PageShell>
    );
  }

  const unsentCount = invoices.filter(
    (invoice) => invoice.sendingStatus === "unsent",
  ).length;
  const unsettledCount = invoices.filter(
    (invoice) => invoice.paymentStatus === "unsettled",
  ).length;

  return (
    <InvoicesView
      companyId={auth.companyId}
      invoices={invoices}
      page={page}
      unsentCount={unsentCount}
      unsettledCount={unsettledCount}
      hasNext={invoices.length === PAGE_SIZE}
    />
  );
}
