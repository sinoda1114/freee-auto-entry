import { AppNavbar } from "./AppNavbar";
import { getSession, isSessionAuthenticated } from "@/lib/session";
import { getConnectedCompanies } from "@/lib/freee/session-client";

export async function AppHeader() {
  const session = await getSession();
  const authenticated = isSessionAuthenticated(session);
  const { companies, activeCompanyId } = authenticated
    ? await getConnectedCompanies()
    : { companies: [], activeCompanyId: undefined };

  return (
    <AppNavbar
      authenticated={authenticated}
      companies={companies}
      activeCompanyId={activeCompanyId}
    />
  );
}
