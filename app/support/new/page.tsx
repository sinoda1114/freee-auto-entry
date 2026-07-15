import type { Metadata } from "next";
import { AuthGate } from "@/app/components/AuthGate";
import { appPageTitle } from "@/lib/app-brand";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { SupportNewView } from "../SupportNewView";

export const metadata: Metadata = {
  title: appPageTitle("メール取り込み"),
};

export default async function SupportNewPage({
  searchParams,
}: {
  searchParams: Promise<{ investigationId?: string }>;
}) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <AuthGate
        title="メール取り込み"
        description="freeeへ再連携してからご利用ください。"
        returnTo="/support/new"
      />
    );
  }

  const params = await searchParams;
  return (
    <SupportNewView
      companyId={auth.companyId}
      investigationId={params.investigationId ?? ""}
    />
  );
}
