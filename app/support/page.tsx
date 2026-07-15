import type { Metadata } from "next";
import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { appPageTitle } from "@/lib/app-brand";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { loadSupportThreadsForPage } from "@/lib/support/page-loaders";
import { SupportListView } from "./SupportListView";

export const metadata: Metadata = {
  title: appPageTitle("問い合わせ履歴"),
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    target?: string;
  }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <AuthGate
        title="問い合わせ履歴"
        description="freeeへ再連携してからご利用ください。"
        returnTo="/support"
      />
    );
  }

  const params = await searchParams;
  let threads;
  try {
    threads = await loadSupportThreadsForPage({
      companyId: auth.companyId,
      query: params.q,
      status: params.status,
      category: params.category,
      target: params.target,
    });
  } catch (error) {
    return (
      <PageShell width="md">
        <PageHeader title="問い合わせ履歴" />
        <p role="alert" className="mt-6 rounded-xl bg-danger-50 p-4 text-danger">
          {error instanceof Error
            ? error.message
            : "問い合わせ履歴を取得できませんでした。"}
        </p>
      </PageShell>
    );
  }

  return (
    <SupportListView
      companyId={auth.companyId}
      threads={threads}
      initialQuery={params.q ?? ""}
      initialStatus={params.status ?? "all"}
      initialCategory={params.category ?? "all"}
      initialTarget={params.target ?? ""}
    />
  );
}
