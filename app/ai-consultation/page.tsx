import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { AiConsultationPageView } from "./AiConsultationPageView";
import { appPageTitle } from "@/lib/app-brand";
import { getValidFreeeAuth } from "@/lib/freee/session-client";

export const metadata = {
  title: appPageTitle("AIに相談する"),
};

export default async function AiConsultationPage() {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <AuthGate title="AIに相談する" />;
  }

  return (
    <PageShell>
      <PageHeader
        title="AIに相談する"
        description="freee の取引・口座振替・明細について、なぜこうなっているかを調べます。freee のデータは変更しません。"
      />
      <AiConsultationPageView companyId={auth.companyId} />
    </PageShell>
  );
}
