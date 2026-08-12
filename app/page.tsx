import { getCanonicalSiteOrigin } from "@/lib/auth/canonical-site";
import { getSession, isSessionAuthenticated } from "@/lib/session";
import { isExpenseCompany } from "@/lib/freee/company-policy";
import { getConnectedCompanies } from "@/lib/freee/session-client";
import { HomeDashboard, HomeHero } from "./HomeView";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const session = await getSession();
  const authenticated = isSessionAuthenticated(session);
  const { activeCompanyId } = authenticated
    ? await getConnectedCompanies()
    : { activeCompanyId: undefined };
  const canRegisterExpense = Boolean(
    activeCompanyId && isExpenseCompany(activeCompanyId),
  );
  const { authError } = await searchParams;
  const siteOrigin = getCanonicalSiteOrigin();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5 sm:px-5">
      {authenticated ? (
        <HomeDashboard
          canRegisterExpense={canRegisterExpense}
          authError={authError}
          siteOrigin={siteOrigin}
        />
      ) : (
        <HomeHero authError={authError} siteOrigin={siteOrigin} />
      )}
    </div>
  );
}
