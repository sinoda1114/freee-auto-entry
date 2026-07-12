import { AppNavbar } from "./AppNavbar";
import { getSession, isSessionAuthenticated } from "@/lib/session";
import { isExpenseCompany } from "@/lib/freee/company-policy";
import { getConnectedCompanies } from "@/lib/freee/session-client";

export async function AppHeader() {
  const session = await getSession();
  const authenticated = isSessionAuthenticated(session);
  const { companies, activeCompanyId } = authenticated
    ? await getConnectedCompanies()
    : { companies: [], activeCompanyId: undefined };
  const canRegisterExpense = Boolean(
    activeCompanyId && isExpenseCompany(activeCompanyId),
  );

  return (
    <AppNavbar
      authenticated={authenticated}
      companies={companies}
      activeCompanyId={activeCompanyId}
      canRegisterExpense={canRegisterExpense}
    />
  );
}
