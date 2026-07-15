import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { appPageTitle } from "@/lib/app-brand";
import { listInvestigationsForThread } from "@/lib/db/support-investigations";
import { getDatabase } from "@/lib/db/turso";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { getSupportThreadForPage } from "@/lib/support/page-loaders";
import { SupportDetailView } from "../SupportDetailView";

export const metadata: Metadata = {
  title: appPageTitle("問い合わせ詳細"),
};

export default async function SupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <AuthGate
        title="問い合わせ詳細"
        description="freeeへ再連携してからご利用ください。"
        returnTo="/support"
      />
    );
  }

  const { id } = await params;
  let thread;
  let investigations;
  try {
    thread = await getSupportThreadForPage(auth.companyId, id);
    if (!thread) {
      notFound();
    }
    investigations = await listInvestigationsForThread(
      getDatabase(),
      auth.companyId,
      id,
    );
  } catch (error) {
    return (
      <PageShell width="md">
        <PageHeader title="問い合わせ詳細" />
        <p role="alert" className="mt-6 rounded-xl bg-danger-50 p-4 text-danger">
          {error instanceof Error
            ? error.message
            : "問い合わせを取得できませんでした。"}
        </p>
      </PageShell>
    );
  }

  return (
    <SupportDetailView
      companyId={auth.companyId}
      thread={thread}
      investigations={investigations}
    />
  );
}
