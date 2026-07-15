import type { Metadata } from "next";
import { AuthGate } from "@/app/components/AuthGate";
import { appPageTitle } from "@/lib/app-brand";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { SupportInvestigateView } from "../SupportInvestigateView";

export const metadata: Metadata = {
  title: appPageTitle("問い合わせ前調査"),
};

export default async function SupportInvestigatePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; target?: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <AuthGate
        title="問い合わせ前調査"
        description="freeeへ再連携してからご利用ください。"
        returnTo="/support/investigate"
      />
    );
  }

  const params = await searchParams;
  return (
    <SupportInvestigateView
      companyId={auth.companyId}
      initialQuestion={params.q ?? ""}
      initialTargetHint={params.target ?? ""}
    />
  );
}
