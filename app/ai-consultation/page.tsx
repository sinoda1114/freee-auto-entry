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
        description="取引・口座振替・明細に加え、損益計算書や貸借対照表も参照して調べます。freee のデータは変更しません。"
      />
      <AiConsultationPageView companyId={auth.companyId} />
    </PageShell>
  );
}
