import { AuthGate } from "@/app/components/AuthGate";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import {
  listRecentMatcherHistory,
  type MatcherHistoryEntry,
} from "@/lib/db/matcher-history";
import { getDatabase } from "@/lib/db/turso";
import { appPageTitle } from "@/lib/app-brand";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { getAllUserMatchers } from "@/lib/freee/wallet";
import { RulesView } from "./RulesView";

export const metadata = {
  title: appPageTitle("自動登録ルール"),
};

export default async function WalletRulesPage() {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return (
      <AuthGate
        title="自動登録ルール"
        description="freeeへ再連携してからルール一覧を確認してください。"
      />
    );
  }

  let matchers;
  try {
    matchers = await getAllUserMatchers(auth, { active: "all" });
  } catch (error) {
    return (
      <PageShell width="md">
        <PageHeader title="自動登録ルール" />
        <p role="alert" className="mt-6 rounded-xl bg-danger-50 p-4 text-danger">
          {error instanceof Error
            ? error.message
            : "ルール一覧を取得できませんでした。"}
        </p>
      </PageShell>
    );
  }

  let history: MatcherHistoryEntry[];
  try {
    history = await listRecentMatcherHistory(getDatabase(), auth.companyId, 20);
  } catch {
    history = [];
  }

  return <RulesView matchers={matchers} history={history} />;
}
